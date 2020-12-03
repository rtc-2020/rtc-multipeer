// Use `sc` for the signaling channel.
// DO NOT connect automatically; wait until Join button is clicked
// See https://socket.io/docs/v3/client-api/index.html#new-Manager-url-options
var sc = io('/' + NAMESPACE, { autoConnect: false });

// Object to hold details about self
var self = {
  DEBUG: true,
  id: '',
  stream: null
};

// Handle self video
(async function() {
  var media_constraints = { video: true, audio: false };
  var selfSource = new MediaStream();
  self.stream = await navigator.mediaDevices.getUserMedia(media_constraints);
  selfSource.addTrack(self.stream.getTracks()[0]);
  document.querySelector('#self-video').srcObject = selfSource;
})();

// Object to hold details about peers
var peers = {};

sc.on('connect', handleConnect);
sc.on('connected peers', handleConnectedPeers);
sc.on('new connected peer', handleNewConnectedPeer);
sc.on('new disconnected peer', handleNewDisconnectedPeer)
sc.on('signal', handleSignal);

/*

  SIGNALING CHANNEL CALLBACK FUNCTIONS

*/

// Set connection diagnostic and self_id assignment
function handleConnect() {
  // Set self.id
  self.id = sc.id;
  if (self.DEBUG) console.log('My ID on the signaling channel is', self.id);
}

// Handle any already connected peers
function handleConnectedPeers(peer_data) {
  if (self.DEBUG) console.log('Connected peers:', peer_data);
  peer_data = removePeer(self.id, peer_data);
  establishPeers(peer_data, false);
  sc.emit('new connected peer', self.id);
}

// Handle new connected peers
function handleNewConnectedPeer(peer_data) {
  if (self.DEBUG) console.log('New connected peer:', peer_data);
  establishPeers(peer_data, true);
}

// Handle new disconnected peer
function handleNewDisconnectedPeer(peer_data) {
  if (self.DEBUG) console.log('New disconnected peer:', peer_data);
}

// Handle RTC signaling over the signaling channel
async function handleSignal({ to, from, candidate, description }) {
  // `from` is key to figuring out who we're negotiating a connection with
  var pc = peers[from].conn;
  var clientIs = peers[from].clientIs; // Set up when pcs object is populated

  try {
    if (description) {
      // W3C/WebRTC Specification Perfect Negotiation Pattern:
      // https://w3c.github.io/webrtc-pc/#example-18
      var readyForOffer =
            !clientIs.makingOffer &&
            (pc.signalingState == "stable" || clientIs.settingRemoteAnswerPending);

      // IMPORTANT! In previous class demos, I erronously was checking for an "answer" type here
      var offerCollision = description.type == "offer" && !readyForOffer;

      clientIs.ignoringOffer = !clientIs.polite && offerCollision;

      if (clientIs.ignoringOffer) {
        return; // Just leave if we're ignoring offers
      }

      // Set the remote description...
      try {
        if (self.DEBUG) console.log('Trying to set a remote description:\n', description);
        clientIs.settingRemoteAnswerPending = description.type == "answer";
        await pc.setRemoteDescription(description);
        clientIs.settingRemoteAnswerPending = false;
      } catch(error) {
        console.error('Error from setting local description', error);
      }

      // ...if it's an offer, we need to answer it:
      if (description.type == 'offer') {
        if (self.DEBUG) console.log('Specifically, an offer description...');
          try {
            // Very latest browsers are totally cool with an
            // argument-less call to setLocalDescription:
            await pc.setLocalDescription();
          } catch(error) {
            // Older (and not even all that old) browsers
            // are NOT cool. So because we're handling an
            // offer, we need to prepare an answer:
            if (self.DEBUG) console.log('Falling back to older setLocalDescription method when receiving an offer...');
            if (pc.signalingState == 'have-remote-offer') {
              // create a answer, if that's what's needed...
              if (self.DEBUG) console.log('Trying to prepare an answer:');
              var offer = await pc.createAnswer();
            } else {
              // otherwise, create an offer
              if (self.DEBUG) console.log('Trying to prepare an offer:');
              var offer = await pc.createOffer();
            }
            await pc.setLocalDescription(offer);
          } finally {
            if (self.DEBUG) console.log('Sending a response:\n', pc.localDescription);
            sc.emit('signal', { to: from, from: self_id, description: pc.localDescription });
          }
      }

    } else if (candidate) {
        if (self.DEBUG) {
          console.log('Received a candidate:');
          console.log(candidate);
        }
        // Save Safari and other browsers that can't handle an
        // empty string for the `candidate.candidate` value:
        try {
          if (candidate.candidate.length > 1) {
            await pc.addIceCandidate(candidate);
          }
        } catch(error) {
          if (!clientIs.ignoringOffer) {
            throw error;
          }
        }
    }
  } catch(error) {
    console.error(error);
  }
}

/*

  RTC UTILITY FUNCTIONS

*/

// Utility function to populate a peer to the peers object
function establishPeers(who,isPolite) {
  // Using Google's STUN servers
  var rtc_config = {
    iceServers: [
      {
        urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']
      }
    ]
  };
  var peers_list = [];
  peers_list.push(who);
  peers_list = peers_list.flat(); // flatten the array, in case array of peers pushed
  // Loop through peers_list (even if single peer)
  for (var peer of peers_list) {
    peers[peer] = {};
    peers[peer].clientIs = {
      polite: isPolite, // Be impolite with existing peers, who will themselves be polite
      makingOffer: false,
      ignoringOffer: false,
      settingRemoteAnswerPending: false
    };
    peers[peer].stream = new MediaStream();
    peers[peer].conn = new RTCPeerConnection(rtc_config);
    // Respond to negotiationneeded events
    peers[peer].conn.onnegotiationneeded = negotiateConnection(peer);
    // Respond to ICE candidate events
    peers[peer].conn.onicecandidate = handleICECandidate(peer);
    // Respond to peer track events
    peers[peer].conn.ontrack = handleOnTrack(peer);
    appendPeerVideoElement(peer);
    addSelfVideoToPeer(peer);
  }
}


/*

  RTC CALLBACK FUNCTIONS

*/

function negotiateConnection(peer_id) {
  return async function() {
    var pc = peers[peer_id].conn;
    var clientIs = peers[peer_id].clientIs; // Set up when pcs object is populated
    try {
      if (self.DEBUG) console.log('Making an offer...');
      clientIs.makingOffer = true;
      try {
        // Very latest browsers are totally cool with an
        // argument-less call to setLocalDescription:
        await pc.setLocalDescription();
      } catch(error) {
        // Older (and not even all that old) browsers
        // are NOT cool. So because we're making an
        // offer, we need to prepare an offer:
        if (self.DEBUG) console.log('Falling back to older setLocalDescription method when making an offer...');
        var offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
      } finally {
        if (self.DEBUG) console.log('Sending an offer:\n', pc.localDescription);
        sc.emit('signal', { to: peer_id, from: self.id, description: pc.localDescription });
      }
    } catch(error) {
      console.error(error);
    } finally {
      clientIs.makingOffer = false;
    }
  }
}

function handleICECandidate(peer_id) {
  return function({candidate}) {
    if (self.DEBUG) console.log(`Sending a candidate to ${peer_id}:\n`, candidate);
    sc.emit('signal', { to: peer_id, from: self.id, candidate: candidate });
  }
}

function handleOnTrack(peer_id) {
  peer = peers[peer_id];
  return function({track}) {
    if (self.DEBUG) console.log('Heard an ontrack event:\n', track);
    // Append track to the correct peer stream object
    track.onunmute = function() {
      if (self.DEBUG) console.log('Heard an unmute event');
      peer.stream.addTrack(track);
    };
  }
}


/*

  DOM ELEMENTS AND EVENTS

*/

// Join button
var joinButton = document.querySelector('#join-call');
joinButton.addEventListener('click', joinCall);

function joinCall(event) {
  // Open the signaling channel connection
  sc.open();
  // Remove the join button
  event.target.remove();
}

// Utility funciton to add video elements to the DOM with an empty MediaStream
function appendPeerVideoElement(peer_id) {
  var videos = document.querySelector('#videos');
  var video = document.createElement('video');
  // Create an empty stream on the peer_streams object;
  // Remote track will be added later
  video.autoplay = true;
  video.id = "video-" + peer_id;
  // Set the video source to the empty peer stream
  video.srcObject = peers[peer_id].stream;
  videos.appendChild(video);
}

// Utility function to add tracks to existing peer streams
function addSelfVideoToPeer(peer_id) {
  for (var track of self.stream.getTracks()) {
    peers[peer_id].conn.addTrack(track);
  }
}

// Utility function to remove peers: self or disconnects
function removePeer(peer_id, peer_list) {
  // If dealing with optional peer_list, remove ID
  if (peer_list) {
    var index = peer_list.indexOf(peer_id);
    if (index === -1) {
      return; // no peer with that ID
    }
    // Remove from list of peers
    peer_list.splice(index,1);
    return peer_list;
  }
  // Remove from peers object
  delete peers[peer_id];
}

// Utlity function to remove videos from the DOM
function removePeerVideoElement(peer_id) {
  var old_video = document.querySelector('#video-' + peer_id);
  if (old_video) {
    old_video.remove();
  }
}

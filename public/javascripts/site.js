// Use `sc` for the signaling channel...
var sc = io.connect('/' + NAMESPACE);

// Track client states, although these will need to be on a per-peer basis
/*
var clientIs = {
  makingOffer: false,
  ignoringOffer: false,
  polite: false,
  settingRemoteAnswerPending: false
}
*/

// Using Google's STUN servers
var rtc_config = {
  iceServers: [
    {
      urls: ['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']
    }
  ]
};

var self_id;
var peers;

// Object to hold each per-ID RTCPeerConnection
var pcs = {};

// Let's handle video streams...
// Set up simple media_constraints
// (disable audio for classroom demo purposes)
var media_constraints = { video: true, audio: false };

// Handle self video
var stream = new MediaStream();
(async function() {
  stream = await navigator.mediaDevices.getUserMedia(media_constraints);
  var selfVideo = document.querySelector('#self-video').srcObject = stream;
})();

/*
  Signaling Logic
*/

// Basic connection diagnostic
sc.on('message', function(data) {
  console.log('Message received:\n', data);
  // Set self_id
  self_id = sc.id;
});

// Receive payload of already-connected peers that socket.io knows about
sc.on('connected peers', function(data) {
  // Remove self from peers array
  peers = removePeer(data,sc.id);
  // Log out the array of connected peers
  console.log('Connected peers:\n', peers);
  // Client announces to everyone else that it has connected
  sc.emit('new connected peer', sc.id);
  // TODO: Set up connections with existing peers
  for (var peer of peers) {
    // Establish peer; set politeness to false with existing peers
    // Existing peers will themselves be polite (true)
    establishPeer(peer,false);
    negotiateConnection(peer);
  }
});

// Receive payload of a newly connected peer
sc.on('new connected peer', function(peer) {
  console.log('New connected peer:', peer);
  // Add the new peer to the peers array
  peers.push(peer);
  // Log out the new array of connected peers
  console.log('New connected peers:\n', peers);
  // Set up connection with new peer; be polite
  establishPeer(peer,true);
  negotiateConnection(peer);
});

// Rececive payload of newly disconnected peer
sc.on('new disconnected peer', function(peer) {
  // Logic to remove the disconnected peer from `peers`
  // Also will need to eventually clean up known peer connections
  // and UI holding the disconnected peer's video, etc.
  console.log(`${peer} has disconnected`);
  peers = removePeer(peers,peer);
  removeVideo(peer);
  console.log('Remaining connected peers:\n', peers);
});

// Signals are now only over private messages to avoid cross-talk
sc.on('signal', async function({ to, from, candidate, description }) {
  // `from` is key to figuring out who we're dealing with
  var pc = pcs[from].conn;
  var clientIs = pcs[from].clientIs; // Set up when pcs object is populated?

  try {
    if (description) {
      // W3C/WebRTC Specification Perfect Negotiation Pattern:
      // https://w3c.github.io/webrtc-pc/#example-18
      var readyForOffer =
            !clientIs.makingOffer &&
            (pc.signalingState == "stable" || clientIs.settingRemoteAnswerPending);

      var offerCollision = description.type == "offer" && !readyForOffer;

      clientIs.ignoringOffer = !clientIs.polite && offerCollision;

      if (clientIs.ignoringOffer) {
        return; // Just leave if we're ignoring offers
      }

      // Set the remote description...
      try {
        console.log('Trying to set a remote description:\n', description);
        clientIs.settingRemoteAnswerPending = description.type == "answer";
        await pc.setRemoteDescription(description);
        clientIs.settingRemoteAnswerPending = false;
      } catch(error) {
        console.error('Error from setting local description', error);
      }

      // ...if it's an offer, we need to answer it:
      if (description.type == 'offer') {
        console.log('Specifically, an offer description...');
          try {
            // Very latest browsers are totally cool with an
            // argument-less call to setLocalDescription:
            await pc.setLocalDescription();
          } catch(error) {
            // Older (and not even all that old) browsers
            // are NOT cool. So because we're handling an
            // offer, we need to prepare an answer:
            console.log('Falling back to older setLocalDescription method when receiving an offer...');
            if (pc.signalingState == 'have-remote-offer') {
              // create a answer, if that's what's needed...
              console.log('Trying to prepare an answer:');
              var offer = await pc.createAnswer();
            } else {
              // otherwise, create an offer
              console.log('Trying to prepare an offer:');
              var offer = await pc.createOffer();
            }
            await pc.setLocalDescription(offer);
          } finally {
            console.log('Sending a response:\n', pc.localDescription);
            sc.emit('signal', { to: from, from: self_id, description: pc.localDescription });
          }
      }

    } else if (candidate) {
        console.log('Received a candidate:');
        console.log(candidate);
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

});


/*

  NEGOTIATE PEER CONNECTIONS

*/

async function negotiateConnection(peer_id) {
  var pc = pcs[peer_id].conn;
  var clientIs = pcs[peer_id].clientIs; // Set up when pcs object is populated?
  pc.onnegotiationneeded = async function() {
    try {
      console.log('Making an offer...');
      clientIs.makingOffer = true;
      try {
        // Very latest browsers are totally cool with an
        // argument-less call to setLocalDescription:
        await pc.setLocalDescription();
      } catch(error) {
        // Older (and not even all that old) browsers
        // are NOT cool. So because we're making an
        // offer, we need to prepare an offer:
        console.log('Falling back to older setLocalDescription method when making an offer...');
        var offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
      } finally {
        console.log('Sending an offer:\n', pc.localDescription);
        sc.emit('signal', { to: peer_id, from: self_id, description: pc.localDescription });
      }
    } catch(error) {
        console.error(error);
    } finally {
        clientIs.makingOffer = false;
    }
  };

  // Logic to send candidate
  pc.onicecandidate = function({candidate}) {
    console.log(`Sending a candidate to ${peer_id}:\n`, candidate);
    sc.emit('signal', { to: peer_id, from: self_id, candidate: candidate });
  };

// End negotiateConnection() function
}


// Utility function to remove peers: self or disconnects
function removePeer(peers,id) {
  var index = peers.indexOf(id);
  if (index === -1) {
    return; // no peer with that ID
  }
  peers.splice(index,1);
  return peers;
}

// Utility function to populate a peer to the pcs object
function establishPeer(peer,isPolite) {
  pcs[peer] = {};
  pcs[peer].clientIs = {
    polite: isPolite, // Be impolite with existing peers, who will themselves be polite
    makingOffer: false,
    ignoringOffer: false,
    settingRemoteAnswerPending: false
  };
  pcs[peer].conn = new RTCPeerConnection(rtc_config);
  // Load up our media stream tracks, too!
  for (var track of stream.getTracks()) {
    pcs[peer].conn.addTrack(track);
  }
  appendVideo(peer);
}

// Utility funciton to add videos to the DOM
function appendVideo(peer) {
  var videos = document.querySelector('#videos');
  var video = document.createElement('video');
  var peer_stream = new MediaStream();
  video.id = "video-" + peer.split('#')[1];
  video.srcObject = peer_stream;
  video.autoplay = true;
  pcs[peer].conn.ontrack = function(track) {
    console.log('Heard an ontrack event');
    peer_stream.addTrack(track.track);
  }
  videos.appendChild(video);
}

// Utlity function to remove videos from the DOM
function removeVideo(peer) {
  document.querySelector('#video-' + peer.split('#')[1]).remove();
}

// Use `sc` for the signaling channel.
// DO NOT connect automatically; wait until Join button is clicked
// See https://socket.io/docs/v3/client-api/index.html#new-Manager-url-options
var sc = io('/' + NAMESPACE, { autoConnect: false });

// Object to hold details about self
var self = {
  DEBUG: true,
  id: ''
};

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
function handleConnectedPeers(peers) {
  if (self.DEBUG) console.log('Connected peers:', peers);
  sc.emit('new connected peer', self.id);
}

// Handle new connected peers
function handleNewConnectedPeer(peer) {
  if (self.DEBUG) console.log('New connected peer:', peer);
}

// Handle new disconnected peer
function handleNewDisconnectedPeer(peer) {
  if (self.DEBUG) console.log('New disconnected peer:', peer);
}

// Handle RTC signaling over the signaling channel
async function handleSignal({ to, from, candidate, description }) {

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
    // Respond to peer track events
    peers[peer].conn.ontrack = handleOnTrack(peer);
    appendVideo(peer);
  }
}


/*

  RTC CALLBACK FUNCTIONS

*/

function handleOnTrack(peer) {
  return function({track}) {
    if (self.DEBUG) console.log('Heard an ontrack event:\n', track);
    // Append track to the correct peer stream object
    track.onunmute = function() {
      if (self.DEBUG) console.log('Heard an unmute event');
      peers[peer].stream.addTrack(track);
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

// Utility funciton to add videos to the DOM with an empty MediaStream
function appendVideo(peer) {
  var videos = document.querySelector('#videos');
  var video = document.createElement('video');
  // Create an empty stream on the peer_streams object;
  // Remote track will be added later
  video.autoplay = true;
  video.id = "video-" + peer;
  // Set the video source to the empty peer stream
  video.srcObject = peers[peer].stream;
  videos.appendChild(video);
}

// Utlity function to remove videos from the DOM
function removeVideo(peer) {
  var old_video = document.querySelector('#video-' + peer);
  if (old_video) {
    old_video.remove();
  }
}

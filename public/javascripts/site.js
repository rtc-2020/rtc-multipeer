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

  RTC CALLBACK FUNCTIONS

*/

/*

  RTC UTILITY FUNCTIONS

*/

// Utility function to populate a peer to the peers object
function establishPeers(who,isPolite) {
  var peers_list = [];
  peers_list.push(who);
  peers_list = peers_list.flat(); // flatten the array, in case array of peers pushed
  // Loop through peers_list (even if single peer)
  for (var peer of peers_list) {
    pcs[peer] = {};
    pcs[peer].clientIs = {
      polite: isPolite, // Be impolite with existing peers, who will themselves be polite
      makingOffer: false,
      ignoringOffer: false,
      settingRemoteAnswerPending: false
    };
    pcs[peer].conn = new RTCPeerConnection(rtc_config);
    // Respond to peer track events
    pcs[peer].conn.ontrack = function({track}) {
      console.log('Heard an ontrack event:\n', track);
      // Append track to the correct peer stream object
      track.onunmute = function() {
        console.log('Heard an unmute event');
        peer_streams[peer].addTrack(track);
      };
    };
    appendVideo(peer);
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
function appendVideo(id) {
  var videos = document.querySelector('#videos');
  var video = document.createElement('video');
  // Create an empty stream on the peer_streams object;
  // Remote track will be added later
  peer_streams[id] = new MediaStream();
  video.autoplay = true;
  video.id = "video-" + id.split('#')[1];
  // Set the video source to the empty peer stream
  video.srcObject = peer_streams[id];
  videos.appendChild(video);
}

// Use `sc` for the signaling channel.
// DO NOT connect automatically; wait until Join button is clicked
// See https://socket.io/docs/v3/client-api/index.html#new-Manager-url-options
var sc = io('/' + NAMESPACE, { autoConnect: false });

// Object to hold details about self
var self = {
  DEBUG: true,
  id: ''
};

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

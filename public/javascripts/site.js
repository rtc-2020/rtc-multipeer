// Use `sc` for the signaling channel...
var sc = io.connect('/' + NAMESPACE);
var self_id;
var peers;

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
});

// Receive payload of a newly connected peer
sc.on('new connected peer', function(peer) {
  console.log('New connected peer:', peer);
  // Add the new peer to the peers array
  peers.push(peer);
  // Log out the new array of connected peers
  console.log('New connected peers:\n', peers);
  // Offer to connect (diagnostic)
  sc.emit('signal', { to: peer, from: self_id, description: "I want to connect!"});
});

// Rececive payload of newly disconnected peer
sc.on('new disconnected peer', function(peer) {
  // Logic to remove the disconnected peer from `peers`
  // Also will need to eventually clean up known peer connections
  // and UI holding the disconnected peer's video, etc.
  console.log(`${peer} has disconnected`);
  peers = removePeer(peers,peer);
  console.log('Remaining connected peers:\n', peers);
});

// Signals are now only over private messages to avoid cross-talk
sc.on('signal', function({ to, from, description, candidate}) {
  // Log the description from its sender
  console.log(`Message from ${from}: ${description}`);
  // Respond to diagnostic connection "offer"
  if (description !== "I want to connect too!") {
    sc.emit('signal', { to: from, from: self_id, description: "I want to connect too!"});
  }
});

// Utility function to remove peers: self or disconnects
function removePeer(peers,id) {
  var index = peers.indexOf(id);
  if (index === -1) {
    return; // no peer with that ID
  }
  peers.splice(index,1);
  return peers;
}

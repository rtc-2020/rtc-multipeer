// Use `sc` for the signaling channel...
var sc = io.connect('/' + NAMESPACE);
var peers;

// Basic connection diagnostic
sc.on('message', function(data) {
  console.log('Message received:\n', data);
});

// Receive payload of already-connected peers
sc.on('connected peers', function(data) {
  peers = removePeer(data,sc.id); // Remove self
  console.log('Connected peers:\n', peers);
  // Client announces to others that it has connected
  sc.emit('new connected peer', sc.id);
});

// Receive payload of a newly connected peer
sc.on('new connected peer', function(peer) {
  console.log('New connected peer:', peer);
  peers.push(peer);
  console.log('New connected peers:\n', peers);
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

// Utility function to remove peers
function removePeer(peers,id) {
  var index = peers.indexOf(id);
  if (index === -1) {
    return; // no peer with that ID
  }
  peers.splice(index,1);
  return peers;
}

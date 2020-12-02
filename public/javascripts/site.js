// Use `sc` for the signaling channel.
// DO NOT connect automatically; wait until Join button is clicked
// See https://socket.io/docs/v3/client-api/index.html#new-Manager-url-options
var sc = io('/' + NAMESPACE, { autoConnect: false });

// Join button
var joinButton = document.querySelector('#join-call');
joinButton.addEventListener('click', joinCall);

function joinCall(event) {
  // Open the signaling channel connection
  sc.open();
  // Remove the join button
  event.target.remove();
}

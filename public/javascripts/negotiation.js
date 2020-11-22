
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

      var offerCollision = description.type == "answer" && !readyForOffer;

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

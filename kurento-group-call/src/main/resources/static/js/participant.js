/*
 * (C) Copyright 2014 Kurento (http://kurento.org/)
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const PARTICIPANT_MAIN_CLASS = 'participant main';
const PARTICIPANT_CLASS = 'participant';

/**
 * Creates a video element for a new participant
 * 
 * @param {String}
 *            name - the name of the new participant, to be used as tag name of
 *            the video element. The tag of the new element will be 'video<name>'
 * @return
 */
function Participant(name, local, isMainParticipant) {
	this.name = name;

	var audioState = true, videoState = true;

	var container = document.getElementById("videoPipContainer");

	var mainVideoElement = document.getElementById("mainVideo");

	var video;

	if (local) {
		video = document.createElement('video');
		video.className = "pip-video";
		container.appendChild(video);
		video.id = 'video-' + name;
		video.autoplay = true;
		video.controls = false;
		video.muted = true;
		video.playsInline = true;
		mainVideoElement.srcObject = localStream;
		video.onclick = function() {
			mainVideoElement.srcObject = localStream;
		}
	}

	this.getElement = function() {
		return container;
	}

	this.getVideoElement = function() {
		return video;
	}

	this.offerToReceiveVideo = function(error, offerSdp, wp) {
		if (error)
			return console.error("sdp offer error")
		console.log('Invoking SDP offer callback function');
		var msg = {
			id : "receiveVideoFrom",
			sender : name,
			sdpOffer : offerSdp
		};
		sendMessage(msg);
	}

	Object.defineProperty(this, 'rtcPeer', {
		writable : true
	});

	this.dispose = function() {
		console.log('Disposing participant ' + this.name);
		if (senderPeer)
			senderPeer.close();
	};

	this.localStream = null;

	var senderPeer;

	this.createPeers = function(localStream) {
		console.log(configuration);
		senderPeer = new RTCPeerConnection(configuration);
		if (isMainParticipant || amIMainParticipant) {
			senderPeer.addStream(localStream);
		} else {
			senderPeer.addTrack(localStream.getAudioTracks()[0], localStream);
		}

		console.info(senderPeer);

		senderPeer.onicecandidate = function(event) {
			console.info("new candidate generated for sender", name,
					event.candidate);
			if (event.candidate) {
				var message = {
					id : 'iceCandidate',
					candidate : event.candidate,
					sender : name
				};
				sendMessage(message);
			}
		}

		senderPeer.onaddstream = function(event) {
			console.info("remote stream detected", name);
			video = document.createElement('video');
			video.className = "pip-video";
			container.appendChild(video);
			video.srcObject = event.stream;
			video.id = 'video-' + event.stream.id;
			video.autoplay = true;
			video.controls = false;
			video.playsInline = true;
			video.onclick = function() {
				mainVideoElement.srcObject = event.stream;
			}
		}

		senderPeer.oniceconnectionstatechange = function() {
			console.info(senderPeer.iceConnectionState, name);
			if (senderPeer.iceConnectionState === 'connected') {
				setTimeout(function() {
					getConnectionDetails(senderPeer).then(
							console.info.bind(console));
				}, 1000);
			}
		}

		// senderPeer.onsignalingstatechange = function() {
		// console.info(senderPeer.signalingState, name);
		// if (senderPeer.signalingState === 'stable') {
		// setTimeout(function() {
		// getConnectionDetails(senderPeer).then(console.info.bind(console));
		// }, 1000);
		// }
		// }

		senderPeer.onremovestream = function(event) {
			var video = document.getElementById('video-' + event.stream.id);
			video.parentNode.removeChild(video);
		}
	}

	this.createAnswer = function(sdp) {
		senderPeer.setRemoteDescription(sdp).then(function() {
			senderPeer.createAnswer(function(sdp) {
				senderPeer.setLocalDescription(sdp);
				var msg = {
					id : "sdp",
					sender : name,
					sdp : sdp
				};
				sendMessage(msg);
			}, console.error);
		}, console.error);
	}

	this.generateSdp = function() {
		senderPeer.createOffer(function(sdp) {
			senderPeer.setLocalDescription(sdp);
			var msg = {
				id : "sdp",
				sender : name,
				sdp : sdp
			};
			sendMessage(msg);
		}, console.error);
	}

	this.addIceCandidate = function(message) {
		senderPeer.addIceCandidate(message.candidate);
	}

	this.setSdp = function(sdp) {
		sdp.type === 'answer' ? senderPeer.setRemoteDescription(sdp) : this
				.createAnswer(sdp);
	}

	this.addStream = function(stream) {
		stream.getTracks().forEach(function(track) {
			senderPeer.addTrack(track, stream);
		});

	}

	this.removeStream = function(stream) {
		senderPeer.removeStream(stream);
	}

	this.removeTrack = function(track) {
		senderPeer.getSenders().forEach(function(sender) {
			if (sender.track === track) {
				senderPeer.removeTrack(sender);
			}
		})
	}

	this.addTrack = function(track) {
		senderPeer.addTrack(track, localStream);
	}

	this.getVideoState = function() {
		return videoState;
	}

	this.toggleVideoState = function() {
		videoState = !videoState;
	}
}

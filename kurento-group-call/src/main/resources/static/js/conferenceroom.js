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

var ws = new WebSocket('wss://ptp.mroads.com:7443/groupcall');
var participants = {};
var name;

var configuration = {
	iceServers : [ {
		"url" : "turn:turn.mroads.com:443?transport=udp",
		"username" : "test",
		"credential" : "test"
	}, {
		"url" : "turn:turn.mroads.com:443?transport=tcp",
		"username" : "test",
		"credential" : "test"
	}, {
		"url" : "turn:turn.mroads.com:80?transport=udp",
		"username" : "test",
		"credential" : "test"
	}, {
		"url" : "turn:turn.mroads.com:80?transport=tcp",
		"username" : "test",
		"credential" : "test"
	}, {
		"url" : "stun:turn.mroads.com:443"
	} ]
};

$(document).ready(function() {
	$.ajax({
		url : "https://global.xirsys.net/_turn/Mroads/",
		type : "PUT",
		async : false,
		headers : {
			"Authorization" : "Basic " + btoa("VijayK-mRoads:9a433bd0-c4d6-11e7-8fda-666e0a0e6f2c")
		},
		success : function(res) {
			console.log(res);
			console.log(res.v);
			console.log("ICE List: ", res.v.iceServers);
			configuration.iceServers = res.v.iceServers.concat(configuration.iceServers);
			console.info("Configuration :", configuration);
		}
	});
})

window.onbeforeunload = function() {
	ws.close();
};

ws.onmessage = function(message) {
	var parsedMessage = JSON.parse(message.data);
	console.info('Received message: ' + message.data);

	switch (parsedMessage.id) {
	case 'existingParticipants':
		onExistingParticipants(parsedMessage);
		break;
	case 'newParticipantArrived':
		onNewParticipant(parsedMessage);
		break;
	case 'participantLeft':
		onParticipantLeft(parsedMessage);
		break;
	case 'receiveVideoAnswer':
		receiveVideoResponse(parsedMessage);
		break;
	case "sdp":
		handleSdp(parsedMessage);
		break;
	case 'iceCandidate':
		participants[parsedMessage.sender].addIceCandidate(parsedMessage);
		break;
	default:
		console.error('Unrecognized message', parsedMessage);
	}
}

function register() {
	name = document.getElementById('name').value;
	var room = document.getElementById('roomName').value;

	document.getElementById('join').style.display = 'none';
	document.getElementById('room').style.display = 'block';

	var message = {
		id : 'joinRoom',
		name : name,
		room : room,
	}
	sendMessage(message);
}

function onNewParticipant(request) {
	receiveVideo(request.name);
}

function receiveVideoResponse(result) {
	participants[result.name].rtcPeer.processAnswer(result.sdpAnswer, function(error) {
		if (error)
			return console.error(error);
	});
}

function handleSdp(result) {
	participants[result.sender].setSdp(result.sdp);
}

function callResponse(message) {
	if (message.response != 'accepted') {
		console.info('Call not accepted by peer. Closing call');
		stop();
	} else {
		webRtcPeer.processAnswer(message.sdpAnswer, function(error) {
			if (error)
				return console.error(error);
		});
	}
}

function onExistingParticipants(msg) {
	var constraints = {
		audio : true,
		video : {
			mandatory : {
				maxWidth : 320,
				maxFrameRate : 15,
				minFrameRate : 15
			}
		}
	};
	console.log(name + " registered in room " + room);
	var participant = new Participant(name, true);
	participants[name] = participant;

	navigator.mediaDevices.getUserMedia(constraints).then(function(stream) {
		participant.getVideoElement().srcObject = stream;
		mainVideoElement = document.getElementById("mainVideo");
		mainVideoElement.srcObject = stream;
		localStream = stream;
		msg.data.forEach(receiveVideoAndGenerateSdp);
	}).catch(console.error);

}

function leaveRoom() {
	sendMessage({
		id : 'leaveRoom'
	});

	for ( var key in participants) {
		participants[key].dispose();
	}

	document.getElementById('join').style.display = 'block';
	document.getElementById('room').style.display = 'none';

	ws.close();
	location.reload();
}

function receiveVideo(sender) {
	var participant = new Participant(sender);
	participants[sender] = participant;
	participant.createPeers(localStream);
}

function receiveVideoAndGenerateSdp(sender) {
	var participant = new Participant(sender);
	participants[sender] = participant;
	participant.createPeers(localStream);
	participants[sender].generateSdp();
}

function onParticipantLeft(request) {
	console.log('Participant ' + request.name + ' left');
	var participant = participants[request.name];
	participant.dispose();
	delete participants[request.name];
}

function sendMessage(message) {
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	console.log('After');
	if (ws.readyState === 1) {
		console.log('entered ready state');
		ws.send(jsonMessage);
	} else {
		ws = new WebSocket('wss://' + location.host + '/groupcall');
		ws.onopen = function() {
			console.log("message send is ");
			console.log(jsonMessage);
			ws.send(jsonMessage);
		}
	}
}

function shareScreen() {

	chrome.runtime.sendMessage('dpgmddfhghbhhldcbjeednoklomllaem', {
		getTargetData : true,
		sources : [ 'screen', 'window', 'tab' ]
	}, function(response) {
		var mediaConstraints = {
			audio : false,
			video : {
				mandatory : {
					chromeMediaSource : 'desktop',
					maxWidth : 1280,
					maxHeight : 720,
					chromeMediaSourceId : ''
				},
				optional : []
			}
		}
		mediaConstraints.video.mandatory.chromeMediaSourceId = response.streamId;

		navigator.getUserMedia(mediaConstraints, function(videoStream) {
			for ( var key in participants) {
				if (key != name) {
					participants[key].addStream(videoStream);
					participants[key].generateSdp();
				}
			}
			videoStream.oninactive = function() {
				for ( var key in participants) {
					if (key != name) {
						participants[key].removeStream(videoStream);
						participants[key].generateSdp();
					}
				}
			}
		}, function(error) {
			console.error(error);
		})

	});
}

function getConnectionDetails(peerConnection) {

	var connectionDetails = {}; // the final result object.

	if (window.chrome) { // checking if chrome

		var reqFields = [ 'googLocalAddress', 'googLocalCandidateType', 'googRemoteAddress', 'googRemoteCandidateType' ];
		return new Promise(function(resolve, reject) {
			peerConnection.getStats(function(stats) {
				console.info(stats.result());
				var filtered = stats.result().filter(function(e) {
					return (e.id.indexOf('Conn-audio') == 0 || e.id.indexOf('Conn-video') == 0 || e.id.indexOf('Conn-data') == 0)
				})[0];
				console.info("filtered:", filtered);
				if (!filtered)
					return reject('Something is wrong...');
				reqFields.forEach(function(e) {
					connectionDetails[e.replace('goog', '')] = filtered.stat(e)
				});
				resolve(JSON.stringify(connectionDetails));
			});
		});

	} else { // assuming it is firefox
		return peerConnection.getStats(null).then(function(stats) {
			var selectedCandidatePair = stats[Object.keys(stats).filter(function(key) {
				return stats[key].selected
			})[0]], localICE = stats[selectedCandidatePair.localCandidateId], remoteICE = stats[selectedCandidatePair.remoteCandidateId];
			connectionDetails.LocalAddress = [ localICE.ipAddress, localICE.portNumber ].join(':');
			connectionDetails.RemoteAddress = [ remoteICE.ipAddress, remoteICE.portNumber ].join(':');
			connectionDetails.LocalCandidateType = localICE.candidateType;
			connectionDetails.RemoteCandidateType = remoteICE.candidateType;
			return JSON.stringify(connectionDetails);
		});

	}
}


function removeTracksAndUpdateSdp(track){
	localStream.removeTrack(track);
	participants[name].getVideoElement.srcObject  = participants[name].getVideoElement.srcObject;
	mainVideoElement.srcObject = participants[name].getVideoElement.srcObject;
	for ( var key in participants) {
		if (key != name) {
			participants[key].removeTrack(track);
			participants[key].generateSdp();
			track.stop();
		}
	}
}

function addTrackAndUpdateSdp(track){
	localStream.addTrack(track);
	for ( var key in participants) {
		if (key != name) {
			participants[key].addTrack(track);
			participants[key].generateSdp();
		}
	}
}

function toggleVideo(){
	console.info("toggle video method called");
	
	if(participants[name].getVideoState()){
		console.log("disabling the video")
		localStream.getVideoTracks().forEach(removeTracksAndUpdateSdp)
	}
	else{
		console.log("enabling the video");
		navigator.mediaDevices.getUserMedia({video:true}).then(function(stream){
			stream.getVideoTracks().forEach(addTrackAndUpdateSdp);
		})
	}
	participants[name].toggleVideoState();
}


function toggleAudio(){
	console.info("toggle audio method called");
	
	if(participants[name].getVideoState()){
		console.log("disabling the audio")
		localStream.getAudioTracks().forEach(removeTracksAndUpdateSdp)
	}
	else{
		console.log("enabling the audio");
		navigator.mediaDevices.getUserMedia({audio:true}).then(function(stream){
			stream.getAudioTracks().forEach(addTrackAndUpdateSdp);
		})
	}
	participants[name].toggleVideoState();
}


function endCall(){
	console.info("end call method called");
	leaveRoom();
}


window.onload = function(){
	setTimeout(function(){
		document.getElementById('name').value = "ankita-"+new Date().getTime();
		document.getElementById('roomName').value = location.search;
		register();
	},2000)
}


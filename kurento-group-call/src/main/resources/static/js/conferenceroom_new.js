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

var ws = new WebSocket('wss://' + 'ptp.mroads.com:7443' + '/groupcall');
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

	document.getElementById('room-header').innerText = 'ROOM ' + room;
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
	participants[result.name].rtcPeer.processAnswer(result.sdpAnswer, function(error) {     //*** rtcPeer
		if (error)
			return console.error(error);
	});
}

function handleSdp(result) {
	participants[result.sender].setSdp(result.sdp);
}

function callResponse(message) {                       //**usage
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

	navigator.mediaDevices.getUserMedia(constraints)
	.then(function(stream) {
	  participant.getVideoElement().srcObject = stream;
	  localStream=stream;
	  msg.data.forEach(receiveVideoAndGenerateSdp);
	})
	.catch(function(err) {
	  console.error(err);
	});

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
	location.reload();               //**
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

function sendMessage(message) {                      //wt msg
	var jsonMessage = JSON.stringify(message);
	console.log('Sending message: ' + jsonMessage);
	if (ws.readyState === 1) {
		ws.send(jsonMessage);
	} else {
		ws = new WebSocket('wss://' + location.host + '/groupcall');
		ws.onopen = function() {
			ws.send(jsonMessage);
		}
	}
}

function shareScreen() 
{

	chrome.runtime.sendMessage('dpgmddfhghbhhldcbjeednoklomllaem', {
		getTargetData : true,
		sources : [ 'screen', 'wiasync : falsendow', 'tab' ]
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

		navigator.mediaDevices.getUserMedia(mediaConstraints)
				.then(function(videoStream) {
			for ( var key in participants) {
				if (key != name) {
					
					participants[key].addStream(videoStream);
					participants[key].generateSdp();
				}
			}
			
			videoStream.oninactive = function() {	navigator.mediaDevices.getUserMedia()
				for ( var key in participants) {
					if (key != name) {
						participants[key].removeStream(videoStream);
						participants[key].generateSdp();
					}
				}
			}
		})
		.catch(function(error) {
			console.error(error);
		}) 

	}); 
		
	
}


var value="true";
function muteAudio()
{ 
	 if(value === "true"){
	    		for(var key in participants){
	    			if(key === name)
	    				{
	    				var audioTracks = localStream.getAudioTracks()[0];
	    				localStream.removeTrack(audioTracks);
	    			     value="false";
	    				}
	    			else
	    				{
	    				participants[key].generateSdp();
	    				}
	    		}
	    	}
	 else{
		 navigator.mediaDevices.getUserMedia({audio:true,video:true})
		    .then(stream=>{
		    	let audioStream = stream.getAudioTracks()[0];
		    	console.log(audioStream);
			    		for(var key in participants){
			    			if(key === name)
			    				{
			    				console.log("length");
			    				console.log(localStream.getAudioTracks().length);
			    				console.log(localStream.getVideoTracks().length);
			    				localStream.addTrack(audioStream);
			    				console.log(localStream.getAudioTracks().length);
			    				console.log(localStream.getVideoTracks().length);
			    				value="true";
			    				}
			    			else
			    				{
			    				participants[key].generateSdp();
			    				}
			    		}
		 	}).catch(function(err) {
		 		console.log(err);
		 	});
	 }
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

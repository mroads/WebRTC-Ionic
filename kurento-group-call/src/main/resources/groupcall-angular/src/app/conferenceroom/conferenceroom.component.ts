import { Component, OnInit, NgZone } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-conferenceroom',
  templateUrl: './conferenceroom.component.html',
  styleUrls: ['./conferenceroom.component.scss']
})
export class ConferenceroomComponent implements OnInit {


  name: string;
  room: string = 'mroads';
  ws: WebSocket;
  participants: Array<any> = [];
  localStream: MediaStream;
  showForm: boolean = true;
  objectkeys = Object.keys;
  activeParticipant: string = '';
  configuration: any = {
    iceServers: [{
      "url": "turn:turn.mroads.com:443?transport=udp",
      "username": "test",
      "credential": "test"
    }, {
      "url": "turn:turn.mroads.com:443?transport=tcp",
      "username": "test",
      "credential": "test"
    }, {
      "url": "turn:turn.mroads.com:80?transport=udp",
      "username": "test",
      "credential": "test"
    }, {
      "url": "turn:turn.mroads.com:80?transport=tcp",
      "username": "test",
      "credential": "test"
    }, {
      "url": "stun:turn.mroads.com:443"
    }]
  };

  constructor(private _ngZone: NgZone, private sanitizer: DomSanitizer, private http: HttpClient) { }

  ngOnInit() {
    this.ws = new WebSocket('wss://'+location.host+'/groupcall');
    this.ws.onopen = function () {
      console.info("websocket opened");
    }

    this.ws.onmessage = this.onmessage.bind(this);

    this.http.put('https://global.xirsys.net/_turn/Mroads/', '', {
      headers: {
        "Authorization": "Basic " + btoa("VijayK-mRoads:9a433bd0-c4d6-11e7-8fda-666e0a0e6f2c")
      }
    }).subscribe(res => {
      console.info("received ice servers",res['v'].iceServers);
      this.configuration.iceServers = this.configuration.iceServers.concat(res['v'].iceServers);
    }
    );
  }

  sanitize(url: string) {
    return this.sanitizer.bypassSecurityTrustUrl(url);
  }

  onmessage(message: MessageEvent): void {
    var parsedMessage = JSON.parse(message.data);
    console.info('Received message: ' + message.data);

    switch (parsedMessage.id) {
      case 'existingParticipants':
        this.onExistingParticipants(parsedMessage);
        break;
      case 'newParticipantArrived':
        this.onNewParticipant(parsedMessage);
        break;
      case 'participantLeft':
        this.onParticipantLeft(parsedMessage);
        break;
      case "sdp":
        this.handleSdp(parsedMessage);
        break;
      case 'iceCandidate':
        this.participants[parsedMessage.sender].addIceCandidate(parsedMessage);
        break;
      default:
        console.error('Unrecognized message', parsedMessage);
    }
  }

  getMediaConstraints(screen): any {
    if (screen) {
      return {
        audio: false,
        video: {
          mandatory: {
            chromeMediaSource: 'desktop',
            maxWidth: 1280,
            maxHeight: 720,
            chromeMediaSourceId: ''
          },
          optional: []
        }
      };
    }
    return {
      audio: true,
      video: {
        mandatory: {
          maxWidth: 320,
          maxFrameRate: 15,
          minFrameRate: 15
        }
      }
    };
  }

  onExistingParticipants(msg: any): void {
    console.log(this.name + " registered in room " + this.room);
    var participant = this.createNewParticipant(this.name, true);
    this.participants[this.name] = participant;
    this.activeParticipant = this.name;
    console.info(participant);
    navigator.getUserMedia(this.getMediaConstraints(false), function (stream) {
      participant.videoUrls.push(this.sanitize(URL.createObjectURL(stream)));
      this.localStream = stream;
      msg.data.forEach(this.receiveVideoAndGenerateSdp.bind(this));
      this._ngZone.run(() => {
      });
    }.bind(this), console.error);
  }

  receiveVideoAndGenerateSdp(sender) {
    var participant = this.createNewParticipant(sender, false);
    this.participants[sender] = participant;
    participant.createPeers(this.localStream);
    this.participants[sender].generateSdp();
  }

  onNewParticipant(message: object): void {
    this.receiveVideo(message['name']);
  }


  receiveVideo(sender) {
    var participant = this.createNewParticipant(sender, false);
    this.participants[sender] = participant;
    participant.createPeers(this.localStream);
  }

  onParticipantLeft(request: any): void {
    console.log('Participant ' + request.name + ' left');
    var participant = this.participants[request.name];
    if (participant) {
      participant.dispose();
      delete this.participants[request.name];
    }
  }


  handleSdp(message: object): void {
    this.participants[message['sender']].setSdp(message['sdp']);
  }

  register(): void {
    var message = {
      id: 'joinRoom',
      name: this.name,
      room: this.room,
    }
    this.showForm = false;
    this.sendMessage(message);
  }

  sendMessage(message: object): void {
    var jsonMessage = JSON.stringify(message);
    console.log('Sending message: ' + jsonMessage);
    if (this.ws.readyState === 1) {
      this.ws.send(jsonMessage);
    } else {
      this.ws = new WebSocket('wss://'+location.host+'/groupcall');
      this.ws.onopen = function () {
        console.info("websocket opened");
        this.ws.send(jsonMessage);
      }.bind(this);
    }
  }


  createNewParticipant(name: string, local: boolean): any {
    var that = this;
    var participant = {
      name: name,
      local: local,
      videoUrls: [],
      senderPeer: undefined,
      active: false,
      createPeers: function (localStream) {
        this.senderPeer = new RTCPeerConnection(that.configuration);
        this.senderPeer.addStream(localStream);

        this.senderPeer.onicecandidate = function (event) {
          console.info("new candidate generated for sender", name, event.candidate);
          if (event.candidate) {
            var message = {
              id: 'iceCandidate',
              candidate: event.candidate,
              sender: name
            };
            that.sendMessage(message);
          }
        }

        this.senderPeer.onaddstream = function (event) {
          console.info("remote stream detected", name);
          this.videoUrls.push(that.sanitize(URL.createObjectURL(event.stream)));
          that._ngZone.run(() => {
          });
        }.bind(this);

        this.senderPeer.oniceconnectionstatechange = function () {
          console.info(this.senderPeer.iceConnectionState, name);
          if (this.senderPeer.iceConnectionState === 'connected') {
            // setTimeout(function() {
            //   getConnectionDetails(senderPeer).then(console.info.bind(console));
            // }, 1000);
          }
        }.bind(this);

        this.senderPeer.onremovestream = function (event) {
          this.videoUrls.pop();
          that._ngZone.run(() => {
          });
        }.bind(this);
      },
      generateSdp: function () {
        this.senderPeer.createOffer(function (sdp) {
          this.senderPeer.setLocalDescription(sdp);
          var msg = {
            id: "sdp",
            sender: name,
            sdp: sdp
          };
          that.sendMessage(msg);
        }.bind(this), console.error);
      },
      addIceCandidate: function (message: RTCIceCandidate) {
        this.senderPeer.addIceCandidate(message.candidate);
      },
      setSdp: function (sdp: RTCSessionDescription) {
        sdp.type === 'answer' ? this.senderPeer.setRemoteDescription(sdp) : this.createAnswer(sdp);
      },
      createAnswer: function (sdp) {
        this.senderPeer.setRemoteDescription(sdp).then(function () {
          this.senderPeer.createAnswer(function (sdp) {
            this.senderPeer.setLocalDescription(sdp);
            var msg = {
              id: "sdp",
              sender: name,
              sdp: sdp
            };
            that.sendMessage(msg);
          }.bind(this), console.error);
        }.bind(this), console.error);
      },
      addStream: function (stream) {
        this.senderPeer.addStream(stream);
      },
      removeStream: function (stream) {
        this.senderPeer.removeStream(stream);
      },
      dispose: function () {
        console.log('Disposing participant ' + this.name);
        if (this.senderPeer)
          this.senderPeer.close();
      }
    }
    return participant;
  }

  shareScreen(): void {
    if (window['chrome'] === undefined)
      return;
    window['chrome'].runtime.sendMessage('dpgmddfhghbhhldcbjeednoklomllaem', {
      getTargetData: true,
      sources: ['screen', 'window', 'tab']
    }, function (response) {
      var mediaConstraints = this.getMediaConstraints(true);
      mediaConstraints.video.mandatory.chromeMediaSourceId = response.streamId;

      navigator.getUserMedia(mediaConstraints, function (videoStream) {
        for (var key in this.participants) {
          if (key != this.name) {
            this.participants[key].addStream(videoStream);
            this.participants[key].generateSdp();
          }
        }
        videoStream.oninactive = function () {
          console.info("video stream inactive");
          for (var key in this.participants) {
            if (key != this.name) {
              this.participants[key].removeStream(videoStream);
              this.participants[key].generateSdp();
            }
          }
        }.bind(this);
      }.bind(this), function (error) {
        console.error(error);
      })

    }.bind(this));
  }

  leaveRoom(): void {
    this.sendMessage({
      id: 'leaveRoom'
    });

    for (var key in this.participants) {
      this.participants[key].dispose();
    }

    this.ws.close();
    location.reload();
  }

}


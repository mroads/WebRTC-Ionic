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

package org.kurento.tutorial.groupcall;

import java.io.IOException;
import java.util.concurrent.ConcurrentMap;

import org.json.JSONObject;
import org.kurento.tutorial.groupcall.jpa.StatsModel;
import org.kurento.tutorial.groupcall.jpa.StatsRepository;
import org.kurento.tutorial.groupcall.selenium.TestCase;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;

//import org.json.simple.JSONArray;
/**
 * 
 * @author Ivan Gracia (izanmail@gmail.com)
 * @since 4.3.1
 */
public class CallHandler extends TextWebSocketHandler {

	private static final Logger log = LoggerFactory.getLogger(CallHandler.class);

	private static final Gson gson = new GsonBuilder().create();
	
	TestCase testCase = new TestCase();

	@Autowired
	private StatsRepository repository;

	@Autowired
	private RoomManager roomManager;

	@Autowired
	private UserRegistry registry;

	@Override
	public void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
		final JsonObject jsonMessage = gson.fromJson(message.getPayload(), JsonObject.class);

		UserSession user = registry.getBySession(session);

		if (user != null) {
			log.info("Incoming message from user '{}': {}", user.getName(), jsonMessage);
		} else {
			log.info("Incoming message from new user: {}", jsonMessage);
		}
		try {

			switch (jsonMessage.get("id").getAsString()) {
			case "joinRoom":
				joinRoom(jsonMessage, session);
				break;
			case "state_msg":
			case "receiveVideoFrom":
			case "iceCandidate":
			case "sdp":
				log.info("Incoming sdp '{}", jsonMessage.get("sender"));
				final String senderName = jsonMessage.get("sender").getAsString();
				log.info(senderName);
				final UserSession sender = registry.getByName(senderName);
				jsonMessage.addProperty("sender", user.getName());
				sender.sendMessage(jsonMessage);
				break;
			case "collectStats":
				log.info("Incoming stats '{}", jsonMessage.get("sender"));
				final Room room2 = roomManager.getRoom(user.getRoomName());
				room2.calculateStats(jsonMessage.get("stats").getAsJsonObject(), user.getName());
				log.info("Incomming stats {}", room2.getStats());
				break;
			case "leaveRoom":
				leaveRoom(user);
				break;
			case "runTestCase":
				testCase.openURL(jsonMessage.get("url").getAsString());
				break;
			case "closeBrowser":
				testCase.closeBrowser();
				break;
			case "msg":
				final Room room = roomManager.getRoom(user.getRoomName());
				log.info("here:");
				room.backup(jsonMessage);
				log.info("Text: {}", jsonMessage.toString());

				ConcurrentMap<String, UserSession> map = room.held();
				for (UserSession key : map.values()) {
					// if(jsonMessage.get("sender").getAsString()==key) {
					key.sendMessage(jsonMessage);
					log.info("user is{}", key);
					// us.sendMessage(jsonMessage);
					// }
				}
				break;

			// case "onIceCandidate":
			// JsonObject candidate =
			// jsonMessage.get("candidate").getAsJsonObject();
			//
			// if (user != null) {
			// IceCandidate cand = new
			// IceCandidate(candidate.get("candidate").getAsString(),
			// candidate.get("sdpMid").getAsString(),
			// candidate.get("sdpMLineIndex").getAsInt());
			// user.addCandidate(cand, jsonMessage.get("name").getAsString());
			// }
			// break;
			default:
				break;
			}
		} catch (Exception e) {
			log.error("Exception", e);
		}
	}

	@Override
	public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
		UserSession user = registry.removeBySession(session);
		if (user != null)
			roomManager.getRoom(user.getRoomName()).leave(user);
	}

	private void joinRoom(JsonObject params, WebSocketSession session) throws IOException {
		final String roomName = params.get("room").getAsString();
		final String name = params.get("name").getAsString();
		log.info("PARTICIPANT {}: trying to join room {}", name, roomName);

		Room room = roomManager.getRoom(roomName);
		final UserSession user = room.join(name, session);
		registry.register(user);
	}

	private void leaveRoom(UserSession user) throws IOException {
		final Room room = roomManager.getRoom(user.getRoomName());
		room.leave(user);
		if (room.getParticipants().isEmpty()) {
			if (room.getStats().size() != 0) {
				StatsModel model = new StatsModel();
				model.setCase_id(room.getName());
				model.setDetails(room.getStats().toString());
				repository.save(model);
			}
			roomManager.removeRoom(room);
		}
	}
}
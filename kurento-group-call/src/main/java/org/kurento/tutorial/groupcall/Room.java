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

import java.io.Closeable;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

import javax.annotation.PreDestroy;

import org.json.JSONObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.web.socket.WebSocketSession;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

/**
 * @author Ivan Gracia (izanmail@gmail.com)
 * @since 4.3.1
 */
public class Room implements Closeable {
	private final Logger log = LoggerFactory.getLogger(Room.class);

	private final ConcurrentMap<String, UserSession> participants = new ConcurrentHashMap();
	private final String name;
	private final JsonObject stats = new JsonObject();

	// public ArrayList<String> msgBackup = new ArrayList<>();
	JsonArray msgBackup = new JsonArray();

	public void backup(JsonObject jsonMessage) {
		log.info("Text {}", msgBackup.toString());
		msgBackup.add(jsonMessage);
	}

	public String getName() {
		return name;
	}

	public Room(String roomName) {
		this.name = roomName;
		log.info("ROOM {} has been created", roomName);
	}

	@PreDestroy
	private void shutdown() {
		this.close();
	}

	/*
	 * when a participant joins it joins a room and creates a session for him , but
	 * when the 2nd participant joins it joins into the same room and creates user
	 * session for himself
	 */
	public UserSession join(String userName, WebSocketSession session) throws IOException {
		log.info("ROOM {}: adding participant {}", userName, userName);
		boolean isMainParticipant = false;

		if (participants.size() == 0) {
			isMainParticipant = true;
		}
		
		
		final UserSession participant = new UserSession(userName, this.name, session,isMainParticipant); // this.name=room
		// upto this pt participant is not added to the room
		joinRoom(participant);
		// now added to participant list
		participants.put(participant.getName(), participant);
		//sendParticipantNames(participant);
		sendParticipantNamesWithRoles(participant);

		return participant;
	}

	public void leave(UserSession user) throws IOException {
		log.debug("PARTICIPANT {}: Leaving room {}", user.getName(), this.name);
		this.removeParticipant(user.getName());
		user.close();
	}

	private Collection<String> joinRoom(UserSession newParticipant) throws IOException {
		final JsonObject newParticipantMsg = new JsonObject();
		newParticipantMsg.addProperty("id", "newParticipantArrived");
		newParticipantMsg.addProperty("name", newParticipant.getName());
		newParticipantMsg.addProperty("role", newParticipant.isMainParticipant());
		
		final List<String> participantsList = new ArrayList(participants.values().size());
		log.debug("ROOM {}: notifying other participants of new participant {}", name, newParticipant.getName());
		// initially participant.values is 0 so it would return empty partcipantlist ,
		// when the 2nd participant comes
		// for him participant.values becomes 1 and it sends the msg to 1st person
		// through ws .
		for (final UserSession participant : participants.values()) {
			try {
				participant.sendMessage(newParticipantMsg);
			} catch (final IOException e) {
				log.debug("ROOM {}: participant {} could not be notified", name, participant.getName(), e);
			}
			participantsList.add(participant.getName());
		}

		
		return participantsList;
	}

	private void removeParticipant(String name) throws IOException {
		participants.remove(name);

		log.debug("ROOM {}: notifying all users that {} is leaving the room", this.name, name);

		final List<String> unnotifiedParticipants = new ArrayList();
		final JsonObject participantLeftJson = new JsonObject();
		participantLeftJson.addProperty("id", "participantLeft");
		participantLeftJson.addProperty("name", name);
		for (final UserSession participant : participants.values()) {
			try {
				// participant.cancelVideoFrom(name);
				participant.sendMessage(participantLeftJson);
			} catch (final IOException e) {
				unnotifiedParticipants.add(participant.getName());
			}
		}

		if (!unnotifiedParticipants.isEmpty()) {
			log.debug("ROOM {}: The users {} could not be notified that {} left the room", this.name,
					unnotifiedParticipants, name);
		}

	}

	public void sendParticipantNames(UserSession user) throws IOException {

		final JsonArray participantsArray = new JsonArray();
		for (final UserSession participant : this.getParticipants()) {
			if (!participant.equals(user)) {
				final JsonElement participantName = new JsonPrimitive(participant.getName());
				participantsArray.add(participantName);
			}
		}

		final JsonObject existingParticipantsMsg = new JsonObject();
		existingParticipantsMsg.addProperty("id", "existingParticipants");
		existingParticipantsMsg.add("data", participantsArray); // except the participant who joins it sends the peerlist to the frontend
		log.debug("PARTICIPANT {}: sending a list of {} participants", user.getName(), participantsArray.size());
		user.sendMessage(existingParticipantsMsg);
		
		// chatsys.addProperty("id","chat");

		JsonObject jsob = new JsonObject();
		jsob.addProperty("id", "existingChat");
		jsob.add("data", msgBackup);
		user.sendMessage(jsob);
		
	}
	public void sendParticipantNamesWithRoles(UserSession user) throws IOException {

		final JsonArray participantsArray = new JsonArray();
		for (final UserSession participant : this.getParticipants()) {
			if (!participant.equals(user)) {
				JsonObject participantDetails = new JsonObject();
				participantDetails.addProperty("name", participant.getName());
				participantDetails.addProperty("role", participant.isMainParticipant());
				participantsArray.add(participantDetails);
			}
		}

		final JsonObject existingParticipantsMsg = new JsonObject();
		existingParticipantsMsg.addProperty("id", "existingParticipants");
		existingParticipantsMsg.add("data", participantsArray);
		existingParticipantsMsg.addProperty("role", user.isMainParticipant());
		log.debug("PARTICIPANT {}: sending a list of {} participants", user.getName(), participantsArray.size());
		user.sendMessage(existingParticipantsMsg);

		// chatsys.addProperty("id","chat");

		JsonObject jsob = new JsonObject();
		jsob.addProperty("id", "existingChat");
		jsob.add("data", msgBackup);
		user.sendMessage(jsob);

	}
	
	
	public void calculateStats(JsonObject data,String userId) {
		if(!stats.has(userId)) {
			stats.add(userId, new JsonArray());
		}
		JsonArray userStats = stats.get(userId).getAsJsonArray();
		userStats.add(data);
	}
	
	public JsonObject getStats() {
		return stats;
	}
	
	
	public Collection<UserSession> getParticipants() {
		return participants.values();
	}

	public UserSession getParticipant(String name) {
		return participants.get(name);
	}

	@Override
	public void close() {
		for (final UserSession user : participants.values()) {
			try {
				user.close();
			} catch (IOException e) {
				log.debug("ROOM {}: Could not invoke close on participant {}", this.name, user.getName(), e);
			}
		}

		participants.clear();

		log.debug("Room {} closed", this.name);
	}

	public ConcurrentMap<String, UserSession> held() {
		return participants;
	}

}
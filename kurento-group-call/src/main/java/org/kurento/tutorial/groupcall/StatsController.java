package org.kurento.tutorial.groupcall;

import java.util.List;

import org.json.JSONObject;
import org.kurento.tutorial.groupcall.jpa.StatsModel;
import org.kurento.tutorial.groupcall.jpa.StatsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@RequestMapping("/stats")
public class StatsController {

	@Autowired
	private StatsRepository repository;

	@RequestMapping("/getAll")
	public @ResponseBody List<StatsModel> getAllStats() {
		return repository.findAll();
	}

	@RequestMapping("/save")
	public @ResponseBody String saveStats(@RequestBody String body) {
		JSONObject jsonBody = new JSONObject(body);
		StatsModel model = new StatsModel();
		model.setCase_id(jsonBody.getString("case"));
		model.setDetails(jsonBody.getString("stats"));
		repository.save(model);
		return "success";
	}
	
	@RequestMapping("/getJSON")
	public @ResponseBody String getJSONFile() {
		List<StatsModel> stats =  repository.findAll();
		JSONObject finalJSON = new JSONObject();
		for(StatsModel value:stats) {
			finalJSON.put(value.getCase_id()+"-"+value.getId(), new JSONObject(value.getDetails()));
		}
		return finalJSON.toString();
	}

}

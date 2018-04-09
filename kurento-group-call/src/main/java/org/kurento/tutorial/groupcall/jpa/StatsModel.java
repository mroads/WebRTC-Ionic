package org.kurento.tutorial.groupcall.jpa;

import javax.persistence.Entity;
import javax.persistence.Id;
import javax.persistence.Table;


@Entity
@Table(name="stats")
public class StatsModel {
	public long getId() {
		return id;
	}
	public void setId(long id) {
		this.id = id;
	}
	public String getCase_id() {
		return case_id;
	}
	public void setCase_id(String case_id) {
		this.case_id = case_id;
	}
	public String getDetails() {
		return details;
	}
	public void setDetails(String details) {
		this.details = details;
	}
	@Id
	private long id;
	private String case_id;
	private String details;
}

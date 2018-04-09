package org.kurento.tutorial.groupcall.jpa;

import org.springframework.context.annotation.Scope;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;


@Repository("StatsRepository")
@Scope("prototype")
public interface StatsRepository  extends JpaRepository<StatsModel, Long>{

}

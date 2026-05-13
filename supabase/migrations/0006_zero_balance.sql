alter table paper_settings alter column starting_balance set default 0;
update paper_settings set starting_balance = 0;

-- El salario mensual deja de generarse solo en la nómina: quitar pendientes auto-creados.
DELETE FROM `employee_daily_salaries`
 WHERE COALESCE(`kind`, '') = 'monthly'
   AND `status` = 'pendiente';

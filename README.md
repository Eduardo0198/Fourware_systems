Repositorio del equipo de Fourware Systems.

Configuracion local recomendada

1. Crea una base local llamada `ppg_preventa`.
2. Importa el dump:
   `mysql -u root -p ppg_preventa < ppg2.sql`
3. Copia `.env.example` a `.env`.
4. Ajusta tus credenciales locales.
5. Inicia la app con `npm start`.

Credenciales locales sugeridas para MySQL

- Usuario: `fourware_local`
- Password: `FwPPG_Local_2026!`

SQL sugerido para crear el usuario local

```sql
CREATE DATABASE IF NOT EXISTS ppg_preventa;
CREATE USER IF NOT EXISTS 'fourware_local'@'localhost' IDENTIFIED BY 'FwPPG_Local_2026!';
GRANT ALL PRIVILEGES ON ppg_preventa.* TO 'fourware_local'@'localhost';
FLUSH PRIVILEGES;
```

AVANCE 4
* CARPETA PDFs CUs se encuentran los datos
* Video Avance 4 -> https://drive.google.com/file/d/1rNuxpt6cMYbWxRt8zKDbWWT-2r6ZYnQr/view?usp=sharing
* PRESENTACION AVANCE 4
* REPORTE AVANCE 4

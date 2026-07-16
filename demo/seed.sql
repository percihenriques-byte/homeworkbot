-- Dados de exemplo do modo demonstração (usuário "Visitante").
SET NAMES utf8mb4;

INSERT IGNORE INTO users (openId, name, email, loginMethod, role, createdAt, updatedAt, lastSignedIn)
VALUES ('demo-visitante', 'Visitante', NULL, 'demo', 'user', NOW(), NOW(), NOW());

SET @uid = (SELECT id FROM users WHERE openId = 'demo-visitante');

INSERT INTO userMemories (userId, title, category, content, source, createdAt, updatedAt)
VALUES (@uid, 'Meu jeito de escrever', 'Estilo', 'Escrevo com frases diretas e um exemplo do dia a dia.', 'Manual', NOW(), NOW());

INSERT INTO tasks (userId, title, description, status, priority, difficulty, type, subject, dueDate, createdAt, updatedAt) VALUES
(@uid, 'Prova de Matemática — frações', 'Estudar capítulos 3 e 4', 'pendente', 'alta', 'médio', 'prova', 'Matemática', DATE_ADD(NOW(), INTERVAL 2 DAY), NOW(), NOW()),
(@uid, 'Lista de exercícios de Física', 'Resolver as 10 questões', 'pendente', 'média', 'difícil', 'tarefa', 'Física', DATE_ADD(NOW(), INTERVAL 4 DAY), NOW(), NOW()),
(@uid, 'Leitura do livro de Português', 'Ler capítulos 1 a 3', 'concluída', 'baixa', 'fácil', 'leitura', 'Português', NULL, NOW(), NOW());

INSERT INTO tasks (userId, title, description, status, priority, difficulty, type, subject, completedContent, createdAt, updatedAt)
VALUES (@uid, 'Redação sobre a Amazônia', 'Escrever 20 linhas sobre a importância da Amazônia', 'pendente', 'alta', 'médio', 'trabalho', 'Geografia',
'A Amazônia é a maior floresta tropical do mundo e tem um papel enorme pro planeta. Ela ajuda a regular o clima, guarda muita água doce e abriga milhares de espécies. Eu acho que a gente precisa cuidar dela, porque quando a floresta é derrubada, todo mundo perde. Um exemplo do dia a dia: até a chuva nas cidades do Sul depende dos "rios voadores" que vêm da Amazônia. (Redação feita pela IA no meu estilo, com base nas minhas memórias.)',
NOW(), NOW());

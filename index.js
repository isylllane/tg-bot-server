require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const { Client } = require('pg');
const express = require('express');
const cors = require('cors'); // Для разрешения запросов из мини-приложения

const app = express();
app.use(cors()); // Разрешаем все cors запросы (для вашего mini app)
app.use(express.json());

// Загрузка переменных окружения
const PORT = process.env.PORT || 3000;
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DATABASE_URL = process.env.DATABASE_URL;
const webAppUrl = "https://t.me/test_db29_bot/schedule";

// Функция для подключения к БД
async function getDbConnection() {
    try {
        const client = new Client({
            connectionString: DATABASE_URL,
        });
        await client.connect();
        return client;
    } catch (error) {
        console.error("Ошибка подключения к базе данных:", error);
        return null;
    }
}

// Функция для добавления данных пользователя в БД
async function addUserToDb(telegramId, data) {
    const client = await getDbConnection();
    if (!client) return;

    try {
        const query = `
            INSERT INTO users (telegram_id, data)
            VALUES ($1, $2)
            ON CONFLICT (telegram_id)
            DO UPDATE SET data = $2;
        `;
        await client.query(query, [telegramId, data]);
        console.log(`Данные пользователя ${telegramId} добавлены/обновлены в БД`);
    } catch (error) {
        console.error("Ошибка при добавлении/обновлении данных пользователя:", error);
    } finally {
        await client.end();
    }
}

// Получение всех данных из таблицы
async function getAllDataFromTable(tableName) {
    const client = await getDbConnection();
    if (!client) return null;

    try {
        const query = `SELECT * FROM ${tableName}`;
        const result = await client.query(query);
        // const resultToJson = JSON.stringify(result.rows, null, 2);
        return result.rows;
    } catch (error) {
        console.error("Ошибка при получении данных из таблицы:", error);
        return null;
    } finally {
        await client.end();
    }
}

async function getUserDataByTelegramId(telegramId) {
    const client = await getDbConnection();
    if (!client) return null;

    try {
        const query = `SELECT * FROM users WHERE telegram_id = $1`;
        const result = await client.query(query, [telegramId]);
        if (result.rows.length > 0) {
            return result.rows[0];  // Возвращаем первый объект (данные пользователя)
        } else {
            console.log(`Пользователь с telegramId ${telegramId} не найден.`);
            return null;
        }

    } catch (error) {
        console.error("Ошибка при получении данных пользователя:", error);
        return null;
    } finally {
        if (client) {
            await client.end();
        }

    }
}

// Endpoint для получения данных из бд
app.get('/api/users', async (req, res) => {
    try {
        const users = await getAllDataFromTable('users');
        if(users){
            res.json(users)
        } else{
            res.status(404).json({ error: 'Данные не найдены' });
        }

    } catch (error) {
        console.error("Ошибка получения всех пользователей", error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});
// Endpoint для получения пользователя по telegramId
app.get('/api/users/:telegramId', async (req, res) => {
    const telegramId = req.params.telegramId;
    try {
        const userData = await getUserDataByTelegramId(telegramId);
        if(userData){
            res.json(userData);
        } else {
            res.status(404).json({ error: 'Пользователь не найден' });
        }

    } catch (error) {
        console.error("Ошибка получения данных пользователя", error);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// Создание бота
const bot = new TelegramBot(TOKEN, { polling: true });

bot.on('message', async (msg) => {
    const user = msg.from;
    const telegramId = user.id;
    const text = msg.text;

    if (text === '/start') {
        const data = {"last_name":user.last_name, "username":user.username, "id":telegramId, "text":"Данные"};
        await addUserToDb(telegramId, data);
        bot.sendMessage(telegramId, `Привет! Данные о вас сохранены.
        \n Имя: ${user.first_name || ''}, Фамилия: ${user.last_name || ''}, Юзернейм: ${user.username || ''}, id_tg: ${telegramId}` );
        bot.sendMessage(telegramId, 'Заходи в наш интернет магазин по кнопке ниже', {
            reply_markup: {
                inline_keyboard: [
                    [{text: 'Сделать заказ', web_app: {url: webAppUrl}}]
                ]
            }
        });

    }


});

// Обработка ошибок
bot.on("error", (error) => {
    console.error("Ошибка бота:", error);
});

app.listen(PORT, () => {
    console.log(`Сервер API запущен на порту ${PORT}`);
});
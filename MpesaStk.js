import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import sqlite3 from 'sqlite3';
import cron from 'node-cron';

const paymentAmount = 100;
const app = express();
const port = 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors());

const db = new sqlite3.Database('transactions255.db');

// Create the transactions table if it doesn't exist
db.run(`
  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phoneNumber TEXT,
    amount INTEGER,
    sync_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    mpesa_receipt TEXT
  )
`);

// Function to save transaction data to the database
const saveTransaction = async (data) => {
    return new Promise((resolve, reject) => {
        db.run(
            'INSERT INTO transactions (phoneNumber, amount, sync_status, created_at, mpesa_receipt) VALUES (?, ?, ?, ?, ?)',
            [data.phoneNumber, data.amount, data.sync_status, data.created_at, data.mpesa_receipt],
            (err) => {
                if (err) {
                    console.error('Error saving transaction:', err.message);
                    reject(err.message);
                } else {
                    console.log('Transaction saved to database');
                    resolve();
                }
            }
        );
    });
};

// Function to check if a phone number is in the database
const isPhoneNumberAndAmountInDatabase = async (phoneNumber, amount) => {
    return new Promise((resolve, reject) => {
        const sql = 'SELECT * FROM transactions WHERE phoneNumber = ? AND amount = ?';
        const params = [phoneNumber, amount];

        console.log('SQL Query:', sql);
        console.log('SQL Parameters:', params);

        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err.message);
            } else {
                resolve(row !== undefined);
            }
        });
    });
};



// Function to delete person's saved data after 24 hours
const deleteOldData = async () => {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    db.run('DELETE FROM transactions WHERE created_at < ?', [twentyFourHoursAgo.toISOString()], (err) => {
        if (err) {
            console.error('Error deleting old data:', err.message);
        } else {
            console.log('Old data deleted from the database');
        }
    });
};

// Schedule the task to delete old data every day at midnight
cron.schedule('0 0 * * *', deleteOldData);

const MpesaStkPush = async (phoneNumber, amount) => {
    const urlInitialize = "https://tinypesa.com/api/v1/express/initialize";
    const urlGetStatus = "https://tinypesa.com/api/v1/express/get_status/";

    const accno = Math.floor(Math.random() * 1000) + 1;
    const apiKey = "cdcbi5kqWqq";

    const saveResponse = async (data) => {
        db.run(
            'INSERT INTO transactions (phoneNumber, amount, sync_status, created_at, mpesa_receipt) VALUES (?, ?, ?, ?, ?)',
            [data.phoneNumber, data.amount, data.sync_status, data.created_at, data.mpesa_receipt],
            (err) => {
                if (err) {
                    console.error('Error saving transaction:', err.message);
                } else {
                    console.log('Transaction saved to database');
                }
            }
        );
    };

    try {
        const initializeResponse = await fetch(urlInitialize, {
            method: "POST",
            headers: {
                Apikey: apiKey,
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: `amount=${amount}&msisdn=${phoneNumber}&account_no=${accno}`,
        });

        if (!initializeResponse.ok) {
            throw new Error("Failed to initialize transaction");
        }

        let isTransactionComplete = false;
        await new Promise(resolve => setTimeout(resolve, 40000));

        while (!isTransactionComplete) {
            const getStatusResponse = await fetch(urlGetStatus + accno.toString(), {
                method: "GET",
                headers: {
                    Accept: "application/json",
                    Apikey: apiKey,
                },
                timeout: 30000,
            });

            if (!getStatusResponse.ok) {
                throw new Error("Failed to retrieve transaction status");
            }

            const statusResponseBody = await getStatusResponse.json();

            if (statusResponseBody.mpesa_receipt != null) {
                await saveTransaction({
                    phoneNumber,
                    amount,
                    sync_status: statusResponseBody.sync_status,
                    created_at: statusResponseBody.created_at,
                    mpesa_receipt: statusResponseBody.mpesa_receipt,
                });

                console.log('Transaction saved to database');
                return;
            } else {
                console.log(statusResponseBody);
                throw new Error("Payment was not successful");
            }

            // Sleep for a while before checking the status again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const transactionData = {
            success: true,
            response: { message: "Transaction completed successfully" },
        };

        return transactionData;
    } catch (error) {
        console.error("Error:", error.message);
        const errorData = {
            success: false,
            error: error.message,
        };
        return errorData;
    }
};

app.post('/api/stk-push', async (req, res) => {
    const { phoneNumber, amount } = req.body;

    try {
        // Check if the phone number is in the database and the transaction is still valid
        const isPhoneNumberExists = await isPhoneNumberAndAmountInDatabase(phoneNumber, amount);

        if (!isPhoneNumberExists) {

            const result = await MpesaStkPush(phoneNumber, amount);

            if (result.success) {
                await saveTransaction({
                    phoneNumber,
                    amount,
                    sync_status: result.response.message,
                    created_at: result.created_at,
                    mpesa_receipt: result.mpesa_receipt,
                });

                res.json({ success: true, message: result.response.message });
            } else {
                res.status(400).json({ error: result.error });
            }
        } else {
            res.status(210).json({ paid: 'Phone number and amount already exist' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});





// Endpoint to get a random number
await new Promise(resolve => setTimeout(resolve, 20000));
app.get('/api/aviatorNumber', async (req, res) => {
    const randomNumber = Math.floor(Math.random() * 10) + 1;
    res.json({number: randomNumber});
});

app.get('/api/amount', (req, res) => {
    const amount = paymentAmount;
    res.json({amount: amount});
});

// Start the server
// app.listen(port, () => {
//     console.log(`Server started on port ${port}`);
// });

export default MpesaStkPush;
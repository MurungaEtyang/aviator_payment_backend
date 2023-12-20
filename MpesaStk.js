import fetch from 'node-fetch';
import express from 'express';
import bodyParser from 'body-parser';
import fs from 'fs';
import cors from 'cors';

const app = express();
const port = 8080;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

app.use(cors());

const tinyApi = async (phoneNumber, amount) => {
    const urlInitialize = "https://tinypesa.com/api/v1/express/initialize";
    const urlGetStatus = "https://tinypesa.com/api/v1/express/get_status/";

    const accno = Math.floor(Math.random() * 1000) + 1;
    const apiKey = "cdcbi5kqWqq";

    const saveResponse = async (fileName, data) => {
        const jsonFilePath = `./${fileName}`;

        await fs.promises.writeFile(jsonFilePath, JSON.stringify(data));

        console.log(`Data saved to ${jsonFilePath}`);
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

        // if (!initializeResponse.ok) {
        //     throw new Error("Failed to initialize transaction");
        // }

        let isTransactionComplete = false;
        await new Promise(resolve => setTimeout(resolve, 30000));

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

            if (statusResponseBody.is_complete === 1) {
                // Check if the payment was successful
                if (statusResponseBody.sync_status === "success" && statusResponseBody.mpesa_receipt !== null) {
                    isTransactionComplete = true;

                    // Save the initializeResponse to a JSON file
                    await saveResponse('initializeResponse.json', await initializeResponse.json());
                } else {
                    throw new Error("Payment was not successful");
                }
            }else {
                console.log(statusResponseBody)
            }

            // Sleep for a while before checking the status again
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        const transactionData = {
            success: true,
            response: { message: "Transaction completed successfully" },
        };

        await saveResponse('response.json', transactionData);

        return transactionData;
    } catch (error) {
        console.error("Error222:", error.message);
        const errorData = {
            success: false,
            error: error.message,
        };
        await saveResponse('responseError.json', errorData);

        return errorData;
    }
};

app.post('/api/stk-push', async (req, res) => {
    const { phoneNumber, amount } = req.body;

    try {
        const result = await tinyApi(phoneNumber, amount);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Server started on port ${port}`);
});

export default tinyApi;

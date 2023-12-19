import express, { Request, Response } from 'express';
import bodyParser from 'body-parser';
import fetch from 'node-fetch';
import * as fs from 'fs/promises';

const app = express();
const port = 3000; // Choose a port number that suits your needs

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const MpesaStk = async (phoneNumber: string, amount: string): Promise<any> => {
    const urlInitialize = "https://tinypesa.com/api/v1/express/initialize";
    const urlGetStatus = "https://tinypesa.com/api/v1/express/get_status/";

    const accno = Math.floor(Math.random() * 1000) + 1;
    const apiKey = "cdcbi5kqWqq";

    const saveResponse = async (fileName: any, data: any) => {
        const jsonFilePath = `./${fileName}`;

        // Write the JSON data to the file
        await fs.writeFile(jsonFilePath, JSON.stringify(data));

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

        if (!initializeResponse.ok) {
            throw new Error("Initialization failed");
        }

        const initializeResponseBody = await initializeResponse.json();

        if (!initializeResponseBody.success) {
            throw new Error("Initialization unsuccessful");
        }

        // Wait for 30 seconds
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Step 2: Check transaction status
        const getStatusResponse = await fetch(`${urlGetStatus}${accno}`, {
            method: "GET",
            headers: {
                Accept: "application/json",
                Apikey: apiKey,
            },
        });

        if (!getStatusResponse.ok) {
            throw new Error("Failed to retrieve transaction status");
        }

        const statusResponseBody = await getStatusResponse.json();

        const transactionData = {
            success: statusResponseBody.is_complete === 1,
            response: statusResponseBody,
        };

        // Save the response data to a JSON file within the project
        await saveResponse('response.json', transactionData);

        return transactionData;

    } catch (error: any) {
        console.error("Error:", error.message);
        const errorData = {
            success: false,
            error: error.message,
        };

        // Save the error data to a JSON file within the project
        await saveResponse('responseError.json', errorData);

        return errorData;
    }
};

app.post('/api/tiny', async (req: Request, res: Response) => {
    try {
        const { phoneNumber, amount } = req.body;

        // Validate input
        if (!phoneNumber || !amount) {
            throw new Error("Phone number and amount are required");
        }

        // Call your existing MpesaStk function
        const result = await MpesaStk(phoneNumber, amount);

        res.json(result);
    } catch (error) {
        console.error("API Error:", error.message);
        res.status(500).json({ success: false, error: "Internal server error" });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});

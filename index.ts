import "dotenv/config";
import express, { Router } from "express";
import type { Response, Request, NextFunction } from "express";
import { blue } from "yoctocolors";
import axios from "axios";
import { AxiosError } from "axios";
import cors from "cors";
import type { CorsOptions } from "cors";

const generateAccessToken = async (
    req: Request,
    _res: Response,
    next: NextFunction
) => {
    const consumerKey = process.env.CONSUMER_KEY;
    const consumerSecret = process.env.CONSUMER_SECRET;

    //create authorization token from base64 encoding of consumerKey:consumerSecret
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString(
        "base64"
    );
    console.info(blue(`[INFO]: auth - ${auth}`));
    const headers = new Headers({
        Authorization: `Basic ${auth}`,
    });
    const request = new Request(
        "https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials",
        { method: "GET", headers }
    );
    return fetch(request).then((response) =>
        response.json().then((data) => {
            req.query.token = data.access_token;
            next();
        })
    );
};

const getTimestamp = () => {
    const date_time = new Date();
    const year = date_time.getFullYear();
    const month = `${date_time.getMonth() + 1}`.padStart(2, "0");
    const date = `${date_time.getDate()}`.padStart(2, "0");
    const hour = `${date_time.getHours()}`.padStart(2, "0");
    const minute = `${date_time.getMinutes()}`.padStart(2, "0");
    const seconds = `${date_time.getSeconds()}`.padStart(2, "0");

    return year + month + date + hour + minute + seconds;
};

const router = Router();

const handleSTKPush = async (req: Request, res: Response) => {
    const { amount, phone } = req.body;
    console.info(blue(`[INFO]: amount - ${amount} | phone - ${phone}`));
    if (!parseInt(amount)) {
        res.status(422).json({
            message: "Expected amount to be a number greater than 0",
        });
        return;
    }
    if (!parseInt(phone)) {
        res.status(422).json({ message: "Expected phone to be a number" });
        return;
    }
    const access_token = req.query.token;
    console.info(blue(`[INFO]: access token - ${access_token}`));

    const shortcode = process.env.SHORTCODE as string;
    const passkey = process.env.PASSKEY;
    const timestamp = getTimestamp();
    console.info(blue(`[INFO]: timestamp - ${timestamp}`));

    //get the base64 of the combination
    const password = Buffer.from(shortcode + passkey + timestamp).toString(
        "base64"
    );
    console.info(blue(`[INFO]: password - ${password}`));

    const callbackURL = "https://1d97-41-90-36-205.ngrok-free.app/callback";

    const payload = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: amount,
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackURL,
        AccountReference: "CompanyXLTD",
        TransactionDesc: "Payment of X",
    };

    try {
        const response = await axios.post(
            "https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest",
            payload,
            {
                headers: {
                    Authorization: `Bearer ${access_token}`,
                },
            }
        );
        res.status(200).json({ message: "success", data: response.data });
    } catch (error) {
        if (error instanceof AxiosError) {
            if (error.response) {
                // The request was made and the server responded with a status code
                // that falls out of the range of 2xx
                const data = error.response.data;
                console.log(data);
                console.log(error.response.status);
                console.log(error.response.headers);
                res.status(422).json({ message: data.errorMessage });
            } else if (error.request) {
                // The request was made but no response was received
                // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
                // http.ClientRequest in node.js
                console.log(error.request);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.log("Error", error.message);
            }
            console.log(error.config);
        }
        res.status(500).json({ message: "Something went wrong" });
    }
};

router.post("/lipa", generateAccessToken, handleSTKPush);

router.post("/callback", async (req, res) => {
    const callbackData = req.body;
    console.info(`[INFO]: callback - ${callbackData}`);
    res.status(200).json({ message: "success" });
});

const app = express();

const corsOption: CorsOptions = {
    origin: "https://sandbox.safaricom.co.ke",
};
app.use(cors(corsOption));
app.use(express.json());

app.use(router);
app.listen(3000, () => {
    console.log("I am listening to port 3000");
});

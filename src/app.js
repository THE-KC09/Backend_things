import express, { urlencoded } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';

const app = express();

app.use(cors({ // like proxy server
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({ limit: '10kb' })); // to parse json data with some limit
app.use(urlencoded({ extended: true })); // to get data in form of url encoded format(some data get from urls too)
app.use(express.static('public'))
app.use(cookieParser())


// import router:

import userRouter from './routes/user.routes.js';

// declaration of routes: (we do this via middleware using .use hook)
app.use("/api/v2/users", userRouter)


export { app };
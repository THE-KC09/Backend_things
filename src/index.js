import dotenv from "dotenv"
import connectDB from "./db/database.js";

// two things to remember 1: always remember to wrap things in try catch block and 2: that DB is in another country so we have to use async await


dotenv.config({
    path: "./env"
})


connectDB()
.then(()=>{
    app.on("err", (error)=>{
        console.log("Error in connecting to the server", error)
        throw error;
    });
    app.listen(process.env.PORT || 8000, () => {
        console.log(`App is running on port ${process.env.PORT}`)
    })
})
.catch((err)=>{
    console.log("Error in connecting to DB", err)
})

/* the first approch to connect the database to main
import express from "express";
app = express()
(async ()=>{
    try {
        await mongoose.connect(`${process.env.MONGODB_URI}/${DB_NAME}`)
        app.on("error", (error)=>{
            console.error("Error connecting to the database", error);
            throw error;
        })
        app.listen(process.env.PORT, ()=>{
            console.log(`App is running on port ${process.env.PORT}`)
        })
    } catch (error) {
        console.error("Error connecting to the database", error);
        throw error;
    }
})()

*/

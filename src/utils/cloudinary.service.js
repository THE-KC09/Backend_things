import { v2 as cloudinary } from "cloudinary"
import { response } from "express";
import fs from "fs"

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});


const uploadOnCloudinary = async (localFilePath) =>{
    try {
        if(!localFilePath) return null // if localfilepath is not in local strage then it will return
        const response = await cloudinary.uploader.upload(localFilePath, {resource_type: "auto"})  // upload file on cloudinary through localstroage file
        // console.log("file is successfully uploaded", response.url)
        fs.unlinkSync(localFilePath)
        return response
        
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the locally saved file if file is not uploaded successfully
        return null;
        
    }
}

export {uploadOnCloudinary}
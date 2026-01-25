// what it will do is to check that is ther user is there or not !

import { User } from "../models/user.model";
import { apiErrors } from "../utils/apiErrors";
import { asyncHandler } from "../utils/asyncHandler";
import jwt from "jsonwebtoken"


export const verifyJWT = asyncHandler(async (req, res, next)=>{
    try {
        const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "")
    
        if (!token) {
            throw new apiErrors(401, "Unathorized request")
        }
    
        const decodedToken =  jwt.verify(token, process.env.ACCESS_SECRET_TOKEN)

        const userinfo = await User.findById(decodedToken?._id).select("-password -refreshToken")

        if (!userinfo) {
            throw new apiErrors(401, "invalid access token!")
        }

        req.userinfo = userinfo;
        next
    } catch (error) {
        throw new apiErrors(401, error?.message || "invalid access token!")
    }


})
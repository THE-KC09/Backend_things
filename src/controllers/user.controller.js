import { apiErrors } from "../utils/apiErrors.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.service.js"
import { apiResponse } from "../utils/apiResponse.js"


const registerUser = asyncHandler(async (req, res)=>{
    const {username, email, password, fullName} =  req.body
    console.log(`email is: ${email}`)



    // validation for empty fields:
    if ([email, fullName, username, password].some((field) => field?.trim() === "" )) {
        throw new apiErrors(400, "this field should not be empty!!")
    }

    // validate for existed user: 
    const existedUser = User.findOne({
        $or: [{email}, {username}]
    })
    if (existedUser) {
        throw new apiErrors(409, "the user is already exists!!")
    }

    // handling files : 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    console.log(avatarLocalPath);
    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    console.log(coverImageLocalPath)

    if (!avatarLocalPath) {
        throw new apiErrors(400, "avatar is required!!")
    }

    // uploading on cloudinary : 
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)

    // checking for avatar :
    if (!avatar) {
        throw new apiErrors(400, "avatar is required!!")
    }

    // create a user in db: 
    const user = await User.create({
        fullName,
        password,
        email,
        username,
        avatar: avatar.url,
        coverImage: coverImage?.url || ""
    })

    // checkon user created or not! (also removing imp field to not to send in response):  
    const userCreated = await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if (!userCreated) {
        throw new apiErrors(500, "Something went wrong while registering user!!")
    }

    // now creating a user object apiresponse: 
    return res.status(201).json(
        new apiResponse(200, userCreated, "user registerd successfully!!")
    )
})




export {registerUser}
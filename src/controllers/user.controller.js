import { apiErrors } from "../utils/apiErrors.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.service.js"
import { apiResponse } from "../utils/apiResponse.js"

const generateAccessandRefreshtoken = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accesstoken = user.generateAccessToken()
        const refreshtoken = user.generateRefreshToken() 
        
        user.refreshToken = refreshtoken
        await user.save({ validateBeforeSave: false })
        

        return {accesstoken, refreshtoken}
    } catch (error) {
        throw new apiErrors(500, "Something went wrong while genrating tokens!")
    }
}

const registerUser = asyncHandler(async (req, res)=>{
    const {username, email, password, fullName} =  req.body



    // validation for empty fields:
    if ([email, fullName, username, password].some((field) => field?.trim() === "" )) {
        throw new apiErrors(400, "this field should not be empty!!")
    }

    // validate for existed user: 
    const existedUser = await User.findOne({
        $or: [{email}, {username}]
    })
    if (existedUser) {
        throw new apiErrors(409, "the user is already exists!!")
    }

    // handling files : 
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // console.log(req.files.coverImage)


    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
        console.log(coverImageLocalPath)
        coverImageLocalPath = req.files.coverImage[0].path
    }

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

const loginUser = asyncHandler(async (req, res)=> {
    // take login info like email and password from user 
    // check that it is empty or not
    // validate the password and email that it exsists or not 
    // login success then provide access and refresh token to user

    const {username, email, password} = req.body

    if (!(username || email)) {
        throw new apiErrors(400, "either email or username is required with password!!")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user) {
        throw new apiErrors(404, "user does not exist!!")
    }

    const isPasswordCorrect = await user.isPasswordCorrect(password)

    if (!isPasswordCorrect) {
        throw new apiErrors(401, "invalid password")
    }
    // console.log(user._id)
    const {refreshtoken, accesstoken} = await generateAccessandRefreshtoken(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // cookies 
    const option = {
        httpOnly: true,
        secure: true
    }

    return res.
    status(200)
    .cookie("accessToken", accesstoken, option)
    .cookie("refreshToken", refreshtoken, option)
    .json(
        new apiResponse(
            200, 
            {
                user: loggedInUser, accesstoken, refreshtoken
            },
            "User logged in successfully"
        )
    )
})

const logoutUser = asyncHandler(async (req, res)=> {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true
        }
    )

    const option = {
        httpOnly: true,
        secure: true
    }
    return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .json(200, {}, "User successfully logged out")
    

})

export {
    registerUser,
    loginUser,
    logoutUser
}
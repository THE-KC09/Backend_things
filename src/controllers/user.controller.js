import { apiErrors } from "../utils/apiErrors.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.service.js"
import { apiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"

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


    let coverImageLocalPath;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0) {
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

const refreshAccessToken = asyncHandler(async (req, res)=>{
    // first check that our access token is expired or not
    // if yes then by hiting a end point in which we compare the refresh token of user to DB's refresh token if it matches then we generate a new access token and send to user and a new refresh token too.

    const inComingToken = req.cookies.refreshToken || req.body.refreshToken
    if (!inComingToken) {
        throw new apiErrors(401, "unauthorized token")
    }
    try {
        
            const decodedToken = jwt.verify(inComingToken, process.env.REFRESH_TOKEN_SECRET)
            const userInfo = await User.findById(decodedToken?._id)
            if (!userInfo) {
                throw new apiErrors(401, "invalid refresh token!")
            }
            if (inComingToken !== userInfo.refreshToken) {
                throw new apiErrors(401, "Refresh token is Expired")
            }
            const option = {
                httpOnly: true,
                secure: true
            }
        
            const {newRefreshToken, accesstoken} = await generateAccessandRefreshtoken(userInfo._id)
            return res
            .status(200)
            .cookie("accessToken", accesstoken, option)
            .cookie("refreshToken", newRefreshToken, option)
            .json(
                new apiResponse(
                    200,
                    "New Refresh token is generated",
                    {accesstoken, refreshToken: newRefreshToken}
                )
            )
        
        
    } catch (error) {
        throw new apiErrors(401, error?.message)
    }


})

const changeCurrentPassword = asyncHandler(async(req, res)=> {
    // extract new pass that send with req 
    // then compare it to the old one if it not same then change it and hash with the bcrypt then save it
    const {oldPass, newPass} = req.body
    const userInfo = await User.findById(req?.user._id)
    const validationPass = await userInfo.isPasswordCorrect(oldPass)
    if (!validationPass) {
        throw new apiErrors(400, "Wrong Password")
    }

    userInfo.password = newPass
    await userInfo.save({validateBeforeSave: true})

    return res
    .status(200)
    .json(new apiResponse(200, {}, "Password Changed Sucessfully"))

    }
)

const updateUserProfile = asyncHandler(async(req, res)=>{
    const {fullName, email} = req.body
    if (!fullName && !email) {
        throw new apiErrors(400, "this fields are required")
    }

    const userInfo = await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                fullName,
                email
            }
        }
    ).select("-password")

    return res
    .status(200)
    .json(200,
        new apiResponse(200, userInfo, "Profile updated successfully")
    )
})

const currentUser = asyncHandler(async(req, res)=> {
    console.log(req.user)
    return res
    .status(200)
    .json(new apiResponse(200, "User fetched Sucessfully",  req.user))
})

const updateAvatar = asyncHandler(async(req, res)=> {
    // handling and updating avatar with multer
    const newAvatarPath = req.file?.path;
    console.log(newAvatarPath)
    if (!newAvatarPath) {
        throw new apiErrors(400, "Avatar is required")
    }

    const newAvatar = await uploadOnCloudinary(newAvatarPath)
    if (!newAvatar.url) {
        throw new apiErrors(500, "Something went wrong while uploading avatar")
    }
    
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {avatar: newAvatar.url}
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, userInfo, "Avatar has been updated successfully")
    )

})

const updateCoverImage = asyncHandler(async(req, res)=> {
    // handling and updating avatar with multer
    const newCoverImagerPath = req.file?.path;
    console.log(newCoverImagerPath)
    if (!newCoverImagerPath) {
        throw new apiErrors(400, "CoverImage is required")
    }

    const newCoverImage = await uploadOnCloudinary(newCoverImagerPath)
    if (!newCoverImage.url) {
        throw new apiErrors(500, "Something went wrong while uploading Cover Image")
    }
    
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {coverImage: newCoverImage.url}
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new apiResponse(200, userInfo, "Cover Image has been updated successfully")
    )


})

const getUserChannelProfile = asyncHandler(async(req, res)=> {
    const {username} = req.params
    if (!username?.trim()) {
        throw new apiErrors(400, "username is required")
    }

    const channel = await User.aggregate([
        {
            $match: {username: username.toLowerCase()}
        },
        {
            $lookup: {
                from: "subscriptions",
                localfield: "_id",
                foreignField: "channel",
                as: "subscribers"
            }
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo"
            }
        },
        {
            $addFields: {
                subscriberCount: {
                    $size: "$subscribers"
                },
                channelSubscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: {$in: [req.user?._id, "$subscribers.subscriber"]},
                        then: true,
                        else: false
                    }
                },
            },
            $project: {
                username: 1,
                fullName: 1,
                avatar: 1,
                coverImage: 1,
                isSubscribed: 1,
                subscriberCount: 1,
                channelSubscribedToCount: 1
            }
        }
    ])
    if (!channel?.length) {
        throw new apiErrors(404, "Channel not found")
    }

    return res
    .status(200)
    .json(
        new apiResponse(200, channel[0], "Channel fetched successfully")
    )
})


export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    currentUser,
    updateUserProfile,
    updateAvatar,
    updateCoverImage,
    getUserChannelProfile
}
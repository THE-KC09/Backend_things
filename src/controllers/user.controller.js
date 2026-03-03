import { apiErrors } from "../utils/apiErrors.js"
import { asyncHandler } from "../utils/asyncHandler.js"
import { User } from "../models/user.model.js"
import { Tweet } from "../models/tweet.model.js"
import { Comment } from "../models/comment.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.service.js"
import { apiResponse } from "../utils/apiResponse.js"
import jwt from "jsonwebtoken"
import mongoose from "mongoose"
import { Playlist } from "../models/playlist.model.js"

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
                localField: "_id",
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
        },
        {
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

const userWatchHistory = asyncHandler(async(req, res)=> { // test karna baki hai
    // nested pipelines
    const userInfo = await User.aggregate([
        {
            $match: {_id: new mongoose.Types.ObjectId(req.user._id)}
        },
        {
            $lookup: {
                from: "videos",
                localField: "watchHistory",
                foreignField: "_id",
                as: "watchHistory",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            as: "owner",
                            pipeline: [
                                {
                                    $project: {
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1
                                    }
                                }
                            ]

                        }
                    },
                    {
                        $addFields: {
                            owner: {$first: "$owner"}   // here it return an array so if we want the valuse of that array then we use $first operator
                        }
                    }
                ]
            }
        }
    ])
    return res
    .status(200)
    .json(
        new apiResponse(200, userInfo[0].watchHistory, "User watch history fetched successfully")
    )
})

const userTweets = asyncHandler(async(req, res)=> {

    // extracted the content from req body
    const {content} = req.body

    // validate that content is not empty
    if (!content?.trim()){
        throw new apiErrors(400, "content is required")
    }

    // now we create a tweet with the content user sended
    const newTweet = await Tweet.create({
        content,
        owner: req.user._id  // suggestion se pata chala
    })

    // now we check that is new tweet created or not!
    const createdTweet = await Tweet.findById(newTweet._id)

    // check is there tweet exist or not
    if (!createdTweet){
        throw new apiErrors(500, "Something went wrong while posting tweet")
    }

    // at last we send respond 
    return res
    .status(201)
    .json(
        new apiResponse(201, "Your tweet has been succesfully uploaded", createdTweet )
    )

})

// just for testing : 
const getUserTweets = asyncHandler(async (req, res) => {
    // TODO: get user tweets
    // Not able to see all the tweets till he/she logs in
    const user = req.user
    if (!user) {
        throw new apiErrors(400, "User Not found!!")
    }

    const allTweets = await Tweet.find({ owner: user._id})

    // const allTweets = await User.aggregate([
    //     {
    //         $match: {_id: user._id}
    //     },
    //     {
            
    //     },
    //     // {
    //     //     $lookup: {
    //     //         from: "tweets",
    //     //         localField: "_id",
    //     //         foreignField: "owner",
    //     //         as: "User_Tweets"  // it gives an array.
    //     //     }
    //     // },
    //     {
    //         $project: {
    //             // tweets: "$User_Tweets"
    //         }
    //     }
    // ])
    return res
    .status(200)
    .json(
        new apiResponse(200, "Tweets fetched successfully" , allTweets)
    )



})
const updateUserTweets = asyncHandler(async(req, res)=>{
    const { content, _id } = req.body
    if (!content) {
        throw new apiErrors(401, "the content is empty")
    }
    const t_id = new mongoose.Types.ObjectId(_id)
    const tweet = await Tweet.findById(t_id)
    if (!tweet) {
        throw apiErrors(401, "unable to fetch the tweet")
    }

    const updatedTweet = await Tweet.findOneAndUpdate(t_id, {
        $set: {
            content
        }
    })


    return res
    .status(200)
    .json(
        new apiResponse(201, "Your tweet has been successfully updated", updatedTweet)
    )

})
const deleteTweet = asyncHandler(async(req, res)=> {
    // can't delete without login:
    const { _id } = req.body
    if (!_id) {
        throw new apiErrors(400, "Something went wrong!!")
    }
    const tweet_id = new mongoose.Types.ObjectId(_id) 

    await Tweet.findByIdAndDelete(tweet_id)
    const dTweet = await Tweet.findById(tweet_id)
    if (dTweet) {
        throw new apiErrors(500, "Unable to delete the tweet")
    }

    return res
    .status(200)
    .json(
        new apiResponse(201, "Tweet has been successfully deleted")
    )
})

const createPlaylist = asyncHandler(async(req, res)=> {
    const { name, description } = req.body
    if (!name) {
        throw new apiErrors(400, "Name is required for playlist")
    }
    const playlist = await Playlist.create({
        name,
        description : description || "",
        owner: req.user._id
    })

    return res
    .status(200)
    .json(
        new apiResponse(201, "Playlist is successfully created, Enjoy your PlayList", playlist)
    )

})
const getUserPlaylists = asyncHandler(async(req, res)=> {
    const allPlaylists = await Playlist.find({ owner: req.user._id})
    if (allPlaylists.length == 0) {
        throw new apiErrors(400, "User doesn't have any playlist")
    }

    return res
    .status(200)
    .json(
        new apiResponse(201, "All playlists of user fetched successfully", allPlaylists)
    )

})
const updatePlaylist = asyncHandler(async(req, res)=>{
    const { name, description, _id} = req.body
    if (!name) {
        throw new apiErrors(401, "New name is required for update")
    }
    const p_id = new mongoose.Types.ObjectId(_id)
    const updatedplaylist = await Playlist.findByIdAndUpdate(p_id, {
        $set: {
            name,
            description
        }
    })

    return res
    .status(200)
    .json(
        new apiResponse(201, "playlist updated successfully", updatedplaylist)
    )

})
const deletePlaylist = asyncHandler(async(req, res)=> {
    const { _id } = req.body
    const playlist_id = new mongoose.Types.ObjectId(_id)
    await Playlist.findByIdAndDelete(playlist_id)
    return res
    .status(200)
    .json(
        new apiResponse(201, "Playlist is successfully deleted")
    )
})
//
const userComment = asyncHandler(async(req, res)=> {
    // extract the comment from the req.body:
    const { description } = req.body

    // validation: 
    if(!description){
        throw new apiErrors(400, "comment is required to do it")
    }

    // now creating a comment in commetSchema:
    const newComment = await Comment.create({
        description,
        owner: req.user._id
    })

    // now we check that is new comment created or not!

    const createdComment = await Comment.findById(newComment._id)

    if (!createdComment) {
        throw new apiErrors(500, "Something went wrong while creating you comment")
    }

    // returning the response:

    return res
    .status(201)
    .json(
        new apiResponse(201, "your comment has been posted successfully", newComment)
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
    getUserChannelProfile,
    userWatchHistory,
    userTweets,
    userComment,
    // for testing: 

    getUserTweets,
    updateUserTweets,
    deleteTweet,
    createPlaylist,
    getUserPlaylists,
    updatePlaylist,
    deletePlaylist
}
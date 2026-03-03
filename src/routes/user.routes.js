import { Router } from "express";
import { changeCurrentPassword, createPlaylist, currentUser, deletePlaylist, deleteTweet, getUserChannelProfile, getUserPlaylists, getUserTweets, loginUser, logoutUser, refreshAccessToken, registerUser, updateAvatar, updateCoverImage, updatePlaylist, updateUserProfile, updateUserTweets, userComment, userTweets, userWatchHistory } from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js"

const router = Router()
router.route("/register").post(
    upload.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
)

router.route("/login").post(loginUser)

// secure route

router.route("/logout").post(verifyJWT, logoutUser) 
router.route("/refresh-Token").post(refreshAccessToken)
router.route("/change-password").post(verifyJWT, changeCurrentPassword)
router.route("/get-user").get(verifyJWT, currentUser)
router.route("/Update-user").patch(verifyJWT, updateUserProfile)
router.route("/update-avatar").patch(verifyJWT, upload.single("avatar"), updateAvatar)
router.route("/Update-cover-image").patch(verifyJWT, upload.single("coverImage"), updateCoverImage)
router.route("/c/:username").get(getUserChannelProfile)
router.route("/history").get(verifyJWT, userWatchHistory)
router.route("/tweets").post(verifyJWT, userTweets)
router.route("/comments").post(verifyJWT, userComment)




// for testing: 


router.route("/get-tweets").get(verifyJWT, getUserTweets)
router.route("/update-tweet").patch(verifyJWT, updateUserTweets)
router.route("/delete-tweet").delete(verifyJWT, deleteTweet)

router.route("/createPlaylist").post(verifyJWT, createPlaylist)
router.route("/userplaylists").get(verifyJWT, getUserPlaylists)
router.route("/updateplaylist").patch(verifyJWT, updatePlaylist)
router.route("/deleteplaylist").delete(verifyJWT, deletePlaylist)






export default router 
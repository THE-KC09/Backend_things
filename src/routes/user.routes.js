import { Router } from "express";
import { changeCurrentPassword, currentUser, getUserChannelProfile, loginUser, logoutUser, refreshAccessToken, registerUser, updateAvatar, updateCoverImage, updateUserProfile, userComment, userTweets, userWatchHistory } from "../controllers/user.controller.js";
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

export default router 
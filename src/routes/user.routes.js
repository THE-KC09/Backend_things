import { Router } from "express";
import { changeCurrentPassword, currentUser, loginUser, logoutUser, refreshAccessToken, registerUser, updateAvatar, updateUserProfile } from "../controllers/user.controller.js";
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

export default router
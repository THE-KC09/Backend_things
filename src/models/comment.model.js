import mongoose, {Schema} from "mongoose";

const commentSchema = new Schema(
    {
        description: {
            type: String,
            required: true
        },
        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        video: {
            type: mongoose.Schema.Types.ObjectId,
            ref : "Video"
        }
    },
    {timestamps: true})

export const Comment = mongoose.model("Comment", commentSchema)
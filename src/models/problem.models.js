import mongoose from "mongoose";

const problemSchema = new mongoose.Schema({
    name: String,
    description: String,
    tags: [String],
    rating: Number,
    level: String,
    noOfSolved: Number,
    noOfTest: Number,
    hasSolution: Boolean,
    solution: String
}, {
    timestamps: true //auto generate createAt and updateAt
})

export default mongoose.model('Problem', problemSchema);

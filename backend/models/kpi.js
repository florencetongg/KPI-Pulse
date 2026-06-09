const mongoose = require('mongoose');

const kpiSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 1000 },
    category: { type: String, required: true, trim: true, maxlength: 80 },
    priority: { 
        type: String, 
        enum: ['low', 'medium', 'high'], 
        default: 'medium' 
    },
    weight: { type: Number, min: 0, max: 100, default: 0 },
    
    // Relationships (References User ID)
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    // Target metrics converted to Numbers for analytics compatibility
    target: { type: Number, required: true, min: 0 },
    currentValue: { type: Number, default: 0 },
    unit: { type: String, required: true, trim: true, maxlength: 30, default: '%' }, 
    progress: { type: Number, min: 0, max: 100, default: 0 },
    
    status: { 
        type: String, 
        enum: ['pending', 'in-progress', 'submitted', 'approved', 'rejected'], 
        default: 'pending' 
    },
    
    // Safe Evidence Configuration
    evidenceName: { type: String, trim: true, maxlength: 180, default: "" },
    evidenceMimeType: {
        type: String,
        enum: [
            '',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/webp',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-powerpoint',
            'application/vnd.openxmlformats-officedocument.presentationml.presentation'
        ],
        default: ''
    },
    evidenceSize: { type: Number, min: 0, max: 5 * 1024 * 1024, default: 0 },
    evidenceRef: { type: mongoose.Schema.Types.ObjectId, ref: 'Evidence', default: null },
    
    comments: { type: String, trim: true, maxlength: 1000, default: "" },
    rejectionReason: { type: String, trim: true, maxlength: 1000, default: "" },
    dueDate: { type: Date, required: true },
    submittedAt: { type: Date, default: null },

    // Cycle / repeat configuration
    // repeatCycle: if true, the KPI resets to pending after each approval (recurring KPI)
    // cycleCount:  maximum number of cycles (0 = unlimited); ignored when repeatCycle is false
    repeatCycle: { type: Boolean, default: false },
    cycleCount: { type: Number, min: 0, default: 0 },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { 
    timestamps: true,
    collection: 'kpirecords'
});

kpiSchema.index({ assignedTo: 1, status: 1, isDeleted: 1 });
kpiSchema.index({ createdBy: 1, isDeleted: 1 });

if (mongoose.models.Kpi) {
    delete mongoose.models.Kpi;
}

module.exports = mongoose.model('Kpi', kpiSchema);

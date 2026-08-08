import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

function sanitizeCaregiverSummary(caregiverProfile, caregiverUser) {
  return {
    _id: caregiverUser._id.toString(),
    userId: caregiverUser._id.toString(),
    name: caregiverUser.name,
    bio: caregiverProfile.bio || "",
    serviceArea: caregiverProfile.serviceArea || "",
    supportedServiceTypes: caregiverProfile.supportedServiceTypes || ["companionship"],
    hourlyRate: caregiverProfile.hourlyRate,
    monthlyRate: caregiverProfile.monthlyRate,
    yearsOfExperience: caregiverProfile.yearsOfExperience,
    skills: caregiverProfile.skills || [],
    languages: caregiverProfile.languages || [],
    availability: caregiverProfile.availability || [],
  };
}
// Booking mutations live in bookingWorkflowController so this module stays marketplace-only.
export async function listCaregivers(request, response) {
  const { serviceType, day, availableOn } = request.query;

  const match = { applicationStatus: "approved" };
  if (serviceType) {
    match.supportedServiceTypes = { $in: [String(serviceType)] };
  }
  if (day) {
    match["availability.day"] = String(day).toLowerCase();
  }

  const profiles = await CaregiverProfile.find(match).populate("userId", "name role isVerified");

  let caregivers = profiles
    .filter((profile) => profile.userId?.isVerified)
    .map((profile) => ({
      caregiver: profile.userId ? sanitizeCaregiverSummary(profile, profile.userId) : null,
      availability: profile.availability || [],
    }))
    .filter((entry) => entry.caregiver)
    .map((entry) => ({
      ...entry.caregiver,
      availability: entry.availability,
    }));

  if (availableOn) {
    const requestedDate = new Date(availableOn);
    if (!Number.isNaN(requestedDate.getTime())) {
      const dayName = requestedDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
      caregivers = caregivers.filter((caregiver) =>
        (caregiver.availability || []).some((slot) => slot.day === dayName),
      );
    }
  }

  response.json({
    success: true,
    data: {
      count: caregivers.length,
      caregivers,
    },
  });
}
export async function getCaregiverAvailability(request, response) {
  const caregiverUser = await User.findById(request.params.id);
  if (!caregiverUser || caregiverUser.role !== "caregiver" || !caregiverUser.isVerified) {
    throw new ApiError(404, "Caregiver not found.");
  }

  const caregiverProfile = await CaregiverProfile.findOne({ userId: caregiverUser._id });
  if (!caregiverProfile || caregiverProfile.applicationStatus !== "approved") {
    throw new ApiError(404, "Caregiver availability is not available.");
  }

  response.json({
    success: true,
    data: {
      caregiver: {
        id: caregiverUser._id.toString(),
        name: caregiverUser.name,
      },
      serviceTypes: caregiverProfile.supportedServiceTypes || [],
      availability: caregiverProfile.availability || [],
    },
  });
}

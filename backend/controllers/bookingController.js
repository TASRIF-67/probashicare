import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";
import { CaregiverReview } from "../models/CaregiverReview.js";

/**
 * Creates the privacy-safe caregiver information shown in the marketplace.
 * @param {import("mongoose").Document} caregiverProfile - Approved professional profile.
 * @param {import("mongoose").Document} caregiverUser - Verified caregiver account.
 * @param {{averageRating: number, reviewCount: number}} ratingSummary - Published review totals.
 * @returns {object} Caregiver marketplace record without email, phone, or documents.
 * @sideEffects None.
 */
function sanitizeCaregiverSummary(
  caregiverProfile,
  caregiverUser,
  ratingSummary,
) {
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
    averageRating: ratingSummary.averageRating,
    reviewCount: ratingSummary.reviewCount,
  };
}
// Booking mutations live in bookingWorkflowController so this module stays marketplace-only.

/**
 * GET /api/caregivers
 * Query: optional serviceType, day, and availableOn filters.
 * Success returns verified approved caregivers with anonymous rating totals.
 * Auth: Family or Admin. Private account and application fields are omitted.
 * @param {import("express").Request} request - Marketplace filter request.
 * @param {import("express").Response} response - Express response writer.
 * @returns {Promise<void>}
 * @sideEffects Reads caregiver profiles and published review aggregates.
 */
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
  const caregiverIds = [];

  for (const profile of profiles) {
    if (profile.userId?.isVerified) {
      caregiverIds.push(profile.userId._id);
    }
  }

  // MongoDB performs the average and count in one grouped query. This avoids
  // loading every full review document into Node.js for marketplace summaries.
  const ratingRows = await CaregiverReview.aggregate([
    {
      $match: {
        caregiverId: {
          $in: caregiverIds,
        },
        moderationStatus: "published",
      },
    },
    {
      $group: {
        _id: "$caregiverId",
        averageRating: {
          $avg: "$rating",
        },
        reviewCount: {
          $sum: 1,
        },
      },
    },
  ]);
  const ratingsByCaregiverId = {};

  for (const ratingRow of ratingRows) {
    ratingsByCaregiverId[ratingRow._id.toString()] = {
      averageRating: Number(ratingRow.averageRating.toFixed(1)),
      reviewCount: ratingRow.reviewCount,
    };
  }

  let caregivers = [];

  for (const profile of profiles) {
    if (!profile.userId?.isVerified) {
      continue;
    }

    const caregiverId = profile.userId._id.toString();
    const ratingSummary = ratingsByCaregiverId[caregiverId] || {
      averageRating: 0,
      reviewCount: 0,
    };

    caregivers.push(
      sanitizeCaregiverSummary(
        profile,
        profile.userId,
        ratingSummary,
      ),
    );
  }

  if (availableOn) {
    const requestedDate = new Date(availableOn);

    if (!Number.isNaN(requestedDate.getTime())) {
      const dayName = requestedDate.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
      const availableCaregivers = [];

      for (const caregiver of caregivers) {
        let worksOnRequestedDay = false;

        for (const slot of caregiver.availability || []) {
          if (slot.day === dayName) {
            worksOnRequestedDay = true;
            break;
          }
        }

        if (worksOnRequestedDay) {
          availableCaregivers.push(caregiver);
        }
      }

      caregivers = availableCaregivers;
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

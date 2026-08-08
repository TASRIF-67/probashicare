import { Booking } from "../models/Booking.js";
import { CaregiverProfile } from "../models/CaregiverProfile.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/ApiError.js";

function sanitizeCaregiverSummary(caregiverProfile, caregiverUser) {
  return {
    _id: caregiverUser._id.toString(),
    userId: caregiverUser._id.toString(),
    name: caregiverUser.name,
    email: caregiverUser.email,
    phone: caregiverProfile.phone || "",
    bio: caregiverProfile.bio || "",
    serviceArea: caregiverProfile.serviceArea || "",
    supportedServiceTypes: caregiverProfile.supportedServiceTypes || ["companionship"],
    hourlyRate: caregiverProfile.hourlyRate,
    monthlyRate: caregiverProfile.monthlyRate,
    yearsOfExperience: caregiverProfile.yearsOfExperience,
    skills: caregiverProfile.skills || [],
    languages: caregiverProfile.languages || [],
    availability: caregiverProfile.availability || [],
    applicationStatus: caregiverProfile.applicationStatus,
  };
}

function formatBookingDocument(booking) {
  const caregiver = booking.caregiverId && typeof booking.caregiverId === "object" ? booking.caregiverId : null;
  const familyMember = booking.familyMemberId && typeof booking.familyMemberId === "object" ? booking.familyMemberId : null;

  return {
    _id: booking._id,
    caregiverId: caregiver?._id ? caregiver._id.toString() : booking.caregiverId?.toString(),
    familyMemberId: familyMember?._id ? familyMember._id.toString() : booking.familyMemberId?.toString(),
    caregiver: caregiver
      ? { id: caregiver._id.toString(), name: caregiver.name, email: caregiver.email }
      : null,
    familyMember: familyMember
      ? { id: familyMember._id.toString(), name: familyMember.name, email: familyMember.email }
      : null,
    bookingType: booking.bookingType,
    serviceType: booking.serviceType,
    startDate: booking.startDate,
    endDate: booking.endDate,
    timeSlot: booking.timeSlot,
    status: booking.status,
    createdAt: booking.createdAt,
    updatedAt: booking.updatedAt,
  };
}

export async function listCaregivers(request, response) {
  const { serviceType, day, availableOn } = request.query;

  const match = { applicationStatus: "approved" };
  if (serviceType) {
    match.supportedServiceTypes = { $in: [String(serviceType)] };
  }
  if (day) {
    match["availability.day"] = String(day).toLowerCase();
  }

  const profiles = await CaregiverProfile.find(match).populate("userId", "name email role");

  let caregivers = profiles
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
  if (!caregiverUser || caregiverUser.role !== "caregiver") {
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
        email: caregiverUser.email,
      },
      serviceTypes: caregiverProfile.supportedServiceTypes || [],
      availability: caregiverProfile.availability || [],
    },
  });
}

export async function createBooking(request, response) {
  const caregiverId = request.body.caregiverId;
  const caregiverUser = await User.findById(caregiverId);
  if (!caregiverUser || caregiverUser.role !== "caregiver") {
    throw new ApiError(404, "Selected caregiver not found.");
  }

  const caregiverProfile = await CaregiverProfile.findOne({ userId: caregiverUser._id });
  if (!caregiverProfile || caregiverProfile.applicationStatus !== "approved") {
    throw new ApiError(409, "This caregiver is not currently accepting bookings.");
  }

  const booking = await Booking.create({
    familyMemberId: request.user._id,
    caregiverId: caregiverUser._id,
    bookingType: request.body.bookingType,
    serviceType: request.body.serviceType,
    startDate: new Date(request.body.startDate),
    endDate: new Date(request.body.endDate),
    timeSlot: request.body.timeSlot,
    status: "pending",
  });

  const populatedBooking = await Booking.findById(booking._id)
    .populate("caregiverId", "name email role")
    .populate("familyMemberId", "name email role");

  response.status(201).json({
    success: true,
    data: {
      message: "Booking request created successfully.",
      booking: formatBookingDocument(populatedBooking),
    },
  });
}

export async function listMyBookings(request, response) {
  const bookings = await Booking.find({ familyMemberId: request.user._id })
    .sort({ startDate: 1, createdAt: -1 })
    .populate("caregiverId", "name email role")
    .populate("familyMemberId", "name email role");

  response.json({
    success: true,
    data: {
      count: bookings.length,
      bookings: bookings.map((booking) => formatBookingDocument(booking)),
    },
  });
}

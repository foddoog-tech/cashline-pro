import { Client, LatLng, TravelMode, Language } from '@googlemaps/google-maps-services-js';

const client = new Client({});

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || '';

if (!GOOGLE_MAPS_API_KEY) {
    console.warn('Google Maps API Key not configured. Maps features will not work.');
}

export interface Location {
    lat: number;
    lng: number;
}

export interface Route {
    distance: number; // in meters
    duration: number; // in seconds
    polyline: string;
    steps: any[];
}

export class MapsService {
    /**
     * Geocoding: تحويل العنوان إلى إحداثيات
     */
    async geocodeAddress(address: string): Promise<Location> {
        try {
            if (!GOOGLE_MAPS_API_KEY) {
                throw new Error('Google Maps API Key not configured');
            }

            const response = await client.geocode({
                params: {
                    address,
                    key: GOOGLE_MAPS_API_KEY,
                    language: 'ar' as Language,
                },
            });

            if (response.data.results.length === 0) {
                throw new Error('Address not found');
            }

            const location = response.data.results[0].geometry.location;
            return {
                lat: location.lat,
                lng: location.lng,
            };
        } catch (error) {
            console.error('Error geocoding address:', error);
            throw error;
        }
    }

    /**
     * Reverse Geocoding: تحويل الإحداثيات إلى عنوان
     */
    async reverseGeocode(lat: number, lng: number): Promise<string> {
        try {
            if (!GOOGLE_MAPS_API_KEY) {
                throw new Error('Google Maps API Key not configured');
            }

            const response = await client.reverseGeocode({
                params: {
                    latlng: { lat, lng },
                    key: GOOGLE_MAPS_API_KEY,
                    language: 'ar' as Language,
                },
            });

            if (response.data.results.length === 0) {
                throw new Error('Address not found');
            }

            return response.data.results[0].formatted_address;
        } catch (error) {
            console.error('Error reverse geocoding:', error);
            throw error;
        }
    }

    /**
     * حساب المسافة بين نقطتين (Haversine formula)
     * Returns distance in meters
     */
    calculateDistance(origin: Location, destination: Location): number {
        const R = 6371e3; // Earth radius in meters
        const φ1 = (origin.lat * Math.PI) / 180;
        const φ2 = (destination.lat * Math.PI) / 180;
        const Δφ = ((destination.lat - origin.lat) * Math.PI) / 180;
        const Δλ = ((destination.lng - origin.lng) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    }

    /**
     * حساب المسافة والوقت باستخدام Google Distance Matrix API
     */
    async getDistanceAndDuration(
        origin: Location,
        destination: Location
    ): Promise<{ distance: number; duration: number }> {
        try {
            if (!GOOGLE_MAPS_API_KEY) {
                // Fallback to Haversine formula
                const distance = this.calculateDistance(origin, destination);
                const duration = Math.round(distance / 10); // Assume 10 m/s average speed
                return { distance, duration };
            }

            const response = await client.distancematrix({
                params: {
                    origins: [`${origin.lat},${origin.lng}`],
                    destinations: [`${destination.lat},${destination.lng}`],
                    key: GOOGLE_MAPS_API_KEY,
                    mode: TravelMode.driving,
                    language: 'ar' as Language,
                },
            });

            const element = response.data.rows[0].elements[0];

            if (element.status !== 'OK') {
                throw new Error('Unable to calculate distance');
            }

            return {
                distance: element.distance.value, // in meters
                duration: element.duration.value, // in seconds
            };
        } catch (error) {
            console.error('Error getting distance and duration:', error);
            // Fallback to Haversine
            const distance = this.calculateDistance(origin, destination);
            const duration = Math.round(distance / 10);
            return { distance, duration };
        }
    }

    /**
     * حساب وقت الوصول المتوقع
     * Returns estimated time in seconds
     */
    async estimateArrivalTime(origin: Location, destination: Location): Promise<number> {
        try {
            const { duration } = await this.getDistanceAndDuration(origin, destination);
            return duration;
        } catch (error) {
            console.error('Error estimating arrival time:', error);
            throw error;
        }
    }

    /**
     * الحصول على المسار الأمثل باستخدام Directions API
     */
    async getOptimalRoute(origin: Location, destination: Location): Promise<Route> {
        try {
            if (!GOOGLE_MAPS_API_KEY) {
                throw new Error('Google Maps API Key not configured');
            }

            const response = await client.directions({
                params: {
                    origin: `${origin.lat},${origin.lng}`,
                    destination: `${destination.lat},${destination.lng}`,
                    key: GOOGLE_MAPS_API_KEY,
                    mode: TravelMode.driving,
                    language: 'ar' as Language,
                },
            });

            if (response.data.routes.length === 0) {
                throw new Error('No route found');
            }

            const route = response.data.routes[0];
            const leg = route.legs[0];

            return {
                distance: leg.distance.value, // in meters
                duration: leg.duration.value, // in seconds
                polyline: route.overview_polyline.points,
                steps: leg.steps,
            };
        } catch (error) {
            console.error('Error getting optimal route:', error);
            throw error;
        }
    }

    /**
     * البحث عن أقرب مندوب متاح
     */
    async findNearestDriver(
        location: Location,
        availableDrivers: Array<{ userId: string; lat: number; lng: number }>
    ): Promise<{ userId: string; distance: number } | null> {
        try {
            if (availableDrivers.length === 0) {
                return null;
            }

            let nearest: { userId: string; distance: number } | null = null;

            for (const driver of availableDrivers) {
                const distance = this.calculateDistance(location, {
                    lat: driver.lat,
                    lng: driver.lng,
                });

                if (!nearest || distance < nearest.distance) {
                    nearest = {
                        userId: driver.userId,
                        distance,
                    };
                }
            }

            return nearest;
        } catch (error) {
            console.error('Error finding nearest driver:', error);
            throw error;
        }
    }

    /**
     * التحقق من أن الموقع ضمن منطقة التوصيل
     */
    isWithinDeliveryArea(
        location: Location,
        centerLocation: Location,
        radiusInMeters: number
    ): boolean {
        const distance = this.calculateDistance(location, centerLocation);
        return distance <= radiusInMeters;
    }

    /**
     * حساب رسوم التوصيل بناءً على المسافة
     */
    calculateDeliveryFee(distanceInMeters: number): number {
        const distanceInKm = distanceInMeters / 1000;

        // رسوم التوصيل الأساسية
        const baseFee = 500; // ريال يمني

        // رسوم إضافية لكل كيلومتر
        const perKmFee = 100; // ريال يمني

        if (distanceInKm <= 2) {
            return baseFee;
        }

        return baseFee + Math.ceil(distanceInKm - 2) * perKmFee;
    }

    /**
     * حساب الوقت المتوقع للتوصيل (بالدقائق)
     */
    estimateDeliveryTime(distanceInMeters: number): number {
        // متوسط السرعة: 30 كم/ساعة
        const averageSpeedKmPerHour = 30;
        const distanceInKm = distanceInMeters / 1000;
        const timeInHours = distanceInKm / averageSpeedKmPerHour;
        const timeInMinutes = Math.ceil(timeInHours * 60);

        // إضافة وقت التحضير (15 دقيقة)
        const preparationTime = 15;

        return timeInMinutes + preparationTime;
    }

    /**
     * الحصول على الاتجاهات النصية
     */
    async getDirections(origin: Location, destination: Location): Promise<string[]> {
        try {
            const route = await this.getOptimalRoute(origin, destination);
            return route.steps.map((step: any) => step.html_instructions);
        } catch (error) {
            console.error('Error getting directions:', error);
            return [];
        }
    }

    /**
     * التحقق من صحة الإحداثيات
     */
    isValidLocation(location: Location): boolean {
        return (
            location.lat >= -90 &&
            location.lat <= 90 &&
            location.lng >= -180 &&
            location.lng <= 180
        );
    }

    /**
     * تنسيق المسافة للعرض
     */
    formatDistance(meters: number): string {
        if (meters < 1000) {
            return `${Math.round(meters)} متر`;
        }
        const km = meters / 1000;
        return `${km.toFixed(1)} كم`;
    }

    /**
     * تنسيق الوقت للعرض
     */
    formatDuration(seconds: number): string {
        const minutes = Math.round(seconds / 60);
        if (minutes < 60) {
            return `${minutes} دقيقة`;
        }
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;
        return `${hours} ساعة و ${remainingMinutes} دقيقة`;
    }
}

// Export singleton instance
export const mapsService = new MapsService();

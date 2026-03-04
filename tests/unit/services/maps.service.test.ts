import { MapsService } from '../../../src/services/maps.service';

describe('MapsService', () => {
    let mapsService: MapsService;

    beforeEach(() => {
        mapsService = new MapsService();
    });

    describe('calculateDistance', () => {
        it('should calculate distance between two points', () => {
            const origin = { lat: 15.3694, lng: 44.1910 }; // Sana'a
            const destination = { lat: 14.5528, lng: 49.6242 }; // Mukalla

            const distance = mapsService.calculateDistance(origin, destination);

            // Distance should be approximately 530 km (530000 meters)
            expect(distance).toBeGreaterThan(500000);
            expect(distance).toBeLessThan(600000);
        });

        it('should return 0 for same location', () => {
            const location = { lat: 15.3694, lng: 44.1910 };

            const distance = mapsService.calculateDistance(location, location);

            expect(distance).toBe(0);
        });
    });

    describe('isValidLocation', () => {
        it('should return true for valid coordinates', () => {
            const location = { lat: 15.3694, lng: 44.1910 };

            const isValid = mapsService.isValidLocation(location);

            expect(isValid).toBe(true);
        });

        it('should return false for invalid latitude', () => {
            const location = { lat: 91, lng: 44.1910 };

            const isValid = mapsService.isValidLocation(location);

            expect(isValid).toBe(false);
        });

        it('should return false for invalid longitude', () => {
            const location = { lat: 15.3694, lng: 181 };

            const isValid = mapsService.isValidLocation(location);

            expect(isValid).toBe(false);
        });
    });

    describe('isWithinDeliveryArea', () => {
        it('should return true if location is within radius', () => {
            const location = { lat: 15.3694, lng: 44.1910 };
            const center = { lat: 15.3700, lng: 44.1900 };
            const radius = 1000; // 1 km

            const isWithin = mapsService.isWithinDeliveryArea(location, center, radius);

            expect(isWithin).toBe(true);
        });

        it('should return false if location is outside radius', () => {
            const location = { lat: 15.3694, lng: 44.1910 };
            const center = { lat: 14.5528, lng: 49.6242 }; // Mukalla
            const radius = 1000; // 1 km

            const isWithin = mapsService.isWithinDeliveryArea(location, center, radius);

            expect(isWithin).toBe(false);
        });
    });

    describe('calculateDeliveryFee', () => {
        it('should return base fee for distances <= 2 km', () => {
            const distance = 1500; // 1.5 km

            const fee = mapsService.calculateDeliveryFee(distance);

            expect(fee).toBe(500);
        });

        it('should calculate fee for distances > 2 km', () => {
            const distance = 5000; // 5 km

            const fee = mapsService.calculateDeliveryFee(distance);

            // Base 500 + (5-2) * 100 = 500 + 300 = 800
            expect(fee).toBe(800);
        });

        it('should round up distance when calculating fee', () => {
            const distance = 2500; // 2.5 km

            const fee = mapsService.calculateDeliveryFee(distance);

            // Base 500 + (3-2) * 100 = 500 + 100 = 600
            expect(fee).toBe(600);
        });
    });

    describe('estimateDeliveryTime', () => {
        it('should estimate delivery time including preparation', () => {
            const distance = 6000; // 6 km

            const time = mapsService.estimateDeliveryTime(distance);

            // 6 km / 30 km/h = 0.2 hours = 12 minutes
            // + 15 minutes preparation = 27 minutes
            expect(time).toBe(27);
        });

        it('should include preparation time for short distances', () => {
            const distance = 1000; // 1 km

            const time = mapsService.estimateDeliveryTime(distance);

            // 1 km / 30 km/h = 0.033 hours = 2 minutes
            // + 15 minutes preparation = 17 minutes
            expect(time).toBe(17);
        });
    });

    describe('formatDistance', () => {
        it('should format meters for distances < 1 km', () => {
            const distance = 500;

            const formatted = mapsService.formatDistance(distance);

            expect(formatted).toBe('500 متر');
        });

        it('should format kilometers for distances >= 1 km', () => {
            const distance = 2500;

            const formatted = mapsService.formatDistance(distance);

            expect(formatted).toBe('2.5 كم');
        });
    });

    describe('formatDuration', () => {
        it('should format minutes for durations < 1 hour', () => {
            const duration = 1800; // 30 minutes

            const formatted = mapsService.formatDuration(duration);

            expect(formatted).toBe('30 دقيقة');
        });

        it('should format hours and minutes for durations >= 1 hour', () => {
            const duration = 5400; // 90 minutes

            const formatted = mapsService.formatDuration(duration);

            expect(formatted).toBe('1 ساعة و 30 دقيقة');
        });
    });

    describe('findNearestDriver', () => {
        it('should find the nearest driver', async () => {
            const location = { lat: 15.3694, lng: 44.1910 };
            const drivers = [
                { userId: 'driver-1', lat: 15.3700, lng: 44.1900 }, // Close
                { userId: 'driver-2', lat: 14.5528, lng: 49.6242 }, // Far
                { userId: 'driver-3', lat: 15.3690, lng: 44.1905 }, // Very close
            ];

            const nearest = await mapsService.findNearestDriver(location, drivers);

            expect(nearest).not.toBeNull();
            expect(nearest?.userId).toBe('driver-3');
        });

        it('should return null if no drivers available', async () => {
            const location = { lat: 15.3694, lng: 44.1910 };
            const drivers: any[] = [];

            const nearest = await mapsService.findNearestDriver(location, drivers);

            expect(nearest).toBeNull();
        });
    });
});

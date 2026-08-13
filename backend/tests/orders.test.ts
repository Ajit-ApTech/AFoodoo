import request from 'supertest';
import app from '../src/app';
import { firestore } from '../src/firebase';
import dayjs from 'dayjs';

jest.mock('../src/firebase', () => {
  const mockDocs: Record<string, any> = {};

  const mockCollection = (colName: string) => ({
    doc: (id?: string) => {
      const docId = id || `mock_${Math.random().toString(36).substring(2, 10)}`;
      return {
        id: docId,
        get: jest.fn().mockImplementation(async () => {
          const data = mockDocs[`${colName}/${docId}`];
          return {
            exists: !!data,
            id: docId,
            data: () => data,
          };
        }),
        set: jest.fn().mockImplementation(async (data: any) => {
          mockDocs[`${colName}/${docId}`] = data;
        }),
        update: jest.fn().mockImplementation(async (data: any) => {
          mockDocs[`${colName}/${docId}`] = {
            ...mockDocs[`${colName}/${docId}`],
            ...data,
          };
        }),
        delete: jest.fn().mockImplementation(async () => {
          delete mockDocs[`${colName}/${docId}`];
        }),
        collection: jest.fn().mockImplementation((subCol: string) => ({
          get: jest.fn().mockResolvedValue({ docs: [] }),
        })),
      };
    },
  });

  const mockRunTransaction = jest.fn().mockImplementation(async (updateFunction: Function) => {
    const mockTransaction = {
      get: jest.fn().mockImplementation(async (docRef: any) => docRef.get()),
      update: jest.fn().mockImplementation(async (docRef: any, data: any) => docRef.update(data)),
      set: jest.fn().mockImplementation(async (docRef: any, data: any) => docRef.set(data)),
    };
    return await updateFunction(mockTransaction);
  });

  return {
    firestore: {
      collection: jest.fn().mockImplementation(mockCollection),
      runTransaction: mockRunTransaction,
    },
    fcm: {
      sendToDevice: jest.fn().mockResolvedValue({ successCount: 1 }),
    },
    firebaseApp: {},
    auth: {},
  };
});

describe('Cutoff Validation & Booking Logic', () => {
  test('Booking before cutoff time succeeds', async () => {
    const slotId = 'slot_future';
    const menuItemId = 'item_1';

    // Mock meal slot with cutoff 10 minutes in future
    const cutoffFuture = dayjs().add(10, 'minute').toDate();
    await firestore.collection('meal_slots').doc(slotId).set({
      name: 'Lunch',
      booking_cutoff_time: { toDate: () => cutoffFuture },
      active: true,
    });

    // Mock menu item
    await firestore.collection('menu_items').doc(menuItemId).set({
      title: 'North Indian Thali',
      price: 12.99,
      is_available: true,
      max_quantity: 10,
      quantity_booked: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .send({
        user_id: 'usr_test_1',
        menu_item_id: menuItemId,
        meal_slot_id: slotId,
        delivery_address: { line1: '123 Main St' },
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toBe('Order placed successfully');
    expect(res.body.orderId).toBeDefined();
  });

  test('Booking after cutoff time is strictly rejected by server', async () => {
    const slotId = 'slot_past';
    const menuItemId = 'item_2';

    // Mock meal slot with cutoff 10 minutes in past
    const cutoffPast = dayjs().subtract(10, 'minute').toDate();
    await firestore.collection('meal_slots').doc(slotId).set({
      name: 'Lunch',
      booking_cutoff_time: { toDate: () => cutoffPast },
      active: true,
    });

    await firestore.collection('menu_items').doc(menuItemId).set({
      title: 'Late Meal',
      price: 12.99,
      is_available: true,
      max_quantity: 10,
      quantity_booked: 0,
    });

    const res = await request(app)
      .post('/api/orders')
      .send({
        user_id: 'usr_test_2',
        menu_item_id: menuItemId,
        meal_slot_id: slotId,
        delivery_address: { line1: '123 Main St' },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Booking cutoff time has passed');
  });

  test('Payment status update works', async () => {
    const orderId = 'ord_pay_1';
    await firestore.collection('orders').doc(orderId).set({
      user_id: 'usr_test_1',
      status: 'booked',
      payment_status: 'pending',
    });

    const res = await request(app)
      .post(`/api/orders/${orderId}/pay`)
      .send({ payment_status: 'paid' });

    expect(res.status).toBe(200);
    expect(res.body.payment_status).toBe('paid');
  });
});

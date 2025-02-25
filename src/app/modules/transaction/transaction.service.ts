import { TTransaction } from './transaction.interface';
import { Transaction } from './transaction.model';
import { User } from '../user/user.model';
import AppError from '../../errors/AppError';
import status from 'http-status';

const createDepositTransactionIntoDb = async (transaction: TTransaction) => {
  const {  type, amount, recipient, user } = transaction;

  const admin = await User.findOne({role: 'admin'});
    if(!admin){
        throw new AppError(status.FORBIDDEN, 'Admin not found');
    }
    admin.totalMoney = admin.totalMoney || 0;

  const userData = await User.findById(user);
  const recipientData = await User.findById(recipient);

  if (!recipientData) {
    throw new AppError(status.NOT_FOUND, 'Recipient not found');
  } else if (!recipientData.isVerified) {
    throw new AppError(status.FORBIDDEN, 'Recipient is not verified');
  } else if (recipientData.isBlocked) {
    throw new AppError(status.FORBIDDEN, 'Recipient is blocked');
  } else if (recipientData.role !== 'user') {
    throw new AppError(status.FORBIDDEN, 'This is not a user');
  }else if(recipientData.phoneNumber === userData?.phoneNumber){
    throw new AppError(status.FORBIDDEN, 'You cannot deposit to yourself');
  }


  if (type !== 'deposit') {
    throw new AppError(status.BAD_REQUEST, 'Invalid transaction type');
  }

  recipientData.balance += amount;
  admin.totalMoney += amount as number;
  await recipientData.save();
  await admin.save();

  const newTransaction = (
    await (await Transaction.create(transaction)).populate('user')
  ).populate('recipient');
  return newTransaction;
};




const createTransferTransactionIntoDb = async (transaction: TTransaction) => {
    const { type, amount, user, recipientNumber } = transaction;

    // Find admin
    const admin = await User.findOne({ role: 'admin' });
    if (!admin) {
        throw new AppError(status.FORBIDDEN, 'Admin not found');
    }
    admin.balance = admin.balance || 0; // Ensure admin balance exists

    // Validate transaction type
    if (type !== 'transfer') {
        throw new AppError(status.BAD_REQUEST, 'Invalid transaction type');
    } else if (amount < 50) {
        throw new AppError(status.BAD_REQUEST, 'Transfer amount must be greater than 50');
    }

    // Find sender (user)
    const userData = await User.findById(user);
    if (!userData) {
        throw new AppError(status.NOT_FOUND, 'User not found');
    }

    // Find recipient (by phone number)
    const recipientData = await User.findOne({ phoneNumber: recipientNumber });
    if (!recipientData) {
        throw new AppError(status.NOT_FOUND, 'Recipient not found');
    } else if (!recipientData.isVerified) {
        throw new AppError(status.FORBIDDEN, 'Recipient is not verified');
    } else if (recipientData.isBlocked) {
        throw new AppError(status.FORBIDDEN, 'Recipient is blocked');
    } else if (recipientData.role !== 'user') {
        throw new AppError(status.FORBIDDEN, 'This is not a user');
    } else if (recipientData.phoneNumber === userData.phoneNumber) {
        throw new AppError(status.FORBIDDEN, 'You cannot transfer to yourself');
    }

    // Check sender's balance
    const transferFee = amount >= 100 ? 5 : 0;
    if (userData.balance < amount + transferFee) {
        throw new AppError(status.BAD_REQUEST, 'Insufficient funds');
    }

    // Perform balance update
    userData.balance -= amount + transferFee;
    recipientData.balance += amount;
    admin.balance += transferFee;

    await userData.save();
    await recipientData.save();
    await admin.save();

    const newTransaction = (
        await (await Transaction.create({
            ...transaction,
            recipient: recipientData._id, 
        })).populate('user')
      ).populate('recipient');
      return newTransaction;
    };





export const transactionServices = {
  createDepositTransactionIntoDb,
  createTransferTransactionIntoDb,
};

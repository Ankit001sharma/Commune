const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionController');
const { protect } = require('../middleware/auth');
const { validateObjectId } = require('../middleware/validate');
const User = require('../models/User');

/*
TEST ROUTE (for development only)
Add money to logged-in user's wallet
You can remove this route before production
*/
router.get('/test/add-money', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    user.wallet.balance += 50000;
    await user.save({ validateBeforeSave: false });

    res.status(200).json({
      status: "success",
      message: "Wallet funded successfully",
      balance: user.wallet.balance
    });

  } catch (error) {
    res.status(500).json({
      status: "error",
      message: "Failed to fund wallet"
    });
  }
});

/* TRANSACTION ROUTES */

router.get('/', protect, transactionController.getMyTransactions);

router.post('/', protect, transactionController.initiateTransaction);

router.get('/:id', protect, validateObjectId, transactionController.getTransaction);

router.put('/:id/escrow', protect, validateObjectId, transactionController.holdEscrow);

router.put('/:id/complete', protect, validateObjectId, transactionController.completeTransaction);

router.put('/:id/cancel', protect, validateObjectId, transactionController.cancelTransaction);

module.exports = router;
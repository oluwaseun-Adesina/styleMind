import { Response } from 'express';
import { SavedOutfit } from '../models/SavedOutfit';

export const getLookbook = async (req: any, res: Response) => {
  try {
    const outfits = await SavedOutfit.find({ uid: req.user.userId }).sort({ createdAt: -1 });
    const formatted = outfits.map(outfit => {
      const obj = outfit.toObject();
      return {
        ...obj,
        id: obj._id.toString(),
        uid: obj.uid.toString()
      };
    });
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch saved outfits' });
  }
};

export const saveOutfit = async (req: any, res: Response) => {
  try {
    const newOutfit = new SavedOutfit({ ...req.body, uid: req.user.userId });
    await newOutfit.save();
    res.json({ 
      ...newOutfit.toObject(),
      id: newOutfit._id.toString(), 
      uid: req.user.userId 
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save outfit' });
  }
};

export const removeOutfit = async (req: any, res: Response) => {
  try {
    await SavedOutfit.findOneAndDelete({ _id: req.params.id, uid: req.user.userId });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
};

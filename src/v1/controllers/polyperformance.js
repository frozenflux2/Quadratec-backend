exports.start = async (req, res) => {
  try {
    res.status(201).json({ result: "success" });
  } catch (err) {
    res.status(500).json(err);
  }
};

import SwiftUI

struct ListingCardView: View {
    let listing: Listing

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Photo placeholder
            ZStack(alignment: .topTrailing) {
                RoundedRectangle(cornerRadius: 8)
                    .fill(Color(.systemGray5))
                    .aspectRatio(1, contentMode: .fit)
                    .overlay {
                        if let photo = listing.photos?.first {
                            AsyncImage(url: URL(string: photo.url)) { image in
                                image.resizable().scaledToFill()
                            } placeholder: {
                                Image(systemName: "photo")
                                    .foregroundStyle(.secondary)
                            }
                            .clipShape(RoundedRectangle(cornerRadius: 8))
                        } else {
                            Image(systemName: "photo")
                                .foregroundStyle(.secondary)
                        }
                    }

                if listing.verificationStatus == "verified" {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(.blue)
                        .padding(6)
                }
            }

            VStack(alignment: .leading, spacing: 2) {
                if let brand = listing.brand {
                    Text(brand.name)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Text(listing.title)
                    .font(.caption)
                    .lineLimit(1)
                Text("AED \(Int(listing.price))")
                    .font(.subheadline.bold())
            }
        }
    }
}

#pragma once
#include<string>
#include<vector>
enum seatstatus
{
    availble = 0,
    sold = 1
};
class film
{
    private:
        int id;
        std::string name;
        std::string time;
        std::string cinemaname;
        float price;
        std::vector<std::vector<int>> seat;

    public:
        film(
            const int newid,
            const std::string& newname,
            const std::string& newtime,
            const std::string& newcinemaname,
            float newprice,
            const std::vector<std::vector<int>>& newseat
        );
        int getid() const;
        const std::string& getname() const;
        const std::string& gettime() const;
        const std::string& getcinemaname() const;
        float getprice() const;
        void showinfo() const;
        void showseat() const;
        bool isseatvalid(int row,int column) const;
        bool sellseat(int row,int column);
        bool refundseat(int row,int column);
        int getsoldcount() const;
        int gettotalcount() const;
        int getremainingcount() const;
        float getevenue() const;
        float getoccupancyrate() const;
};
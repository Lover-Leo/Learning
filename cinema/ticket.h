#pragma once
#include<string>
enum ticketstatus
{
    valid = 0,
    funded = 1
};
class ticket
{
    private:
        int id;
        std::string name;
        int filmid;
        int seatrow;
        int seatcolumn;
        int price;
        ticketstatus status;
    public:
        ticket(
            const int newid,
            const std::string& newname,
            const int newfilmid,
            const int newseatrow,
            const int newseatcolumn,
            const int newprice,
            const ticketstatus newstatus
        );
        int getid() const;
        const std::string& getname() const;
        int getfilmid() const;
        int getseatrow() const;
        int getseatcolumn() const;
        int getprice() const;
        ticketstatus getstatus() const;
        bool fundticket();
        void showinfo() const;
}; 